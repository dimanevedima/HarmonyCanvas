"""Note-name / pitch-class tables and chord-label normalization, originally
written to read SongMaster Pro's export format (``Gb:m7``, ``D/5`` degree
slashes). `m2tm_chord` is the one piece `ptm_analysis.parse_chord` still
depends on: it accepts both that SongMaster spelling and compact tokens
(``Gbm7``, ``D/F#``) and normalizes either into the compact form the rest of
the harmony engine expects.
"""

import re
NOTE_TO_PC = {
    "C": 0, "B#": 0,
    "C#": 1, "Db": 1,
    "D": 2,
    "D#": 3, "Eb": 3,
    "E": 4, "Fb": 4,
    "E#": 5, "F": 5,
    "F#": 6, "Gb": 6,
    "G": 7,
    "G#": 8, "Ab": 8,
    "A": 9,
    "A#": 10, "Bb": 10,
    "B": 11, "Cb": 11,
}

PC_TO_SHARP = {
    0: "C",
    1: "C#",
    2: "D",
    3: "D#",
    4: "E",
    5: "F",
    6: "F#",
    7: "G",
    8: "G#",
    9: "A",
    10: "A#",
    11: "B",
}

PC_TO_FLAT = {
    0: "C",
    1: "Db",
    2: "D",
    3: "Eb",
    4: "E",
    5: "F",
    6: "Gb",
    7: "G",
    8: "Ab",
    9: "A",
    10: "Bb",
    11: "B",
}

DEGREE_TO_SEMITONE = {
    "1": 0,
    "b2": 1,
    "2": 2,
    "#2": 3,
    "b3": 3,
    "3": 4,
    "4": 5,
    "#4": 6,
    "b5": 6,
    "5": 7,
    "#5": 8,
    "b6": 8,
    "6": 9,
    "bb7": 9,
    "b7": 10,
    "7": 11,
}

LETTER_TO_NATURAL_PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

LETTERS = ["C", "D", "E", "F", "G", "A", "B"]

def _chord_root(chord: str) -> str:
    chord = (chord or "").strip()
    if not chord:
        return ""
    root = chord[0].upper()
    if len(chord) > 1 and chord[1] in ("#", "b"):
        root += chord[1]
    return root if root in NOTE_TO_PC else ""

def _prefer_flats(root: str) -> bool:
    return "b" in root or root in {"F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"}

def _pc_name(pc: int, root: str) -> str:
    table = PC_TO_FLAT if _prefer_flats(root) else PC_TO_SHARP
    return table[pc % 12]

def _bass_from_degree(root: str, degree: str) -> str:
    normalized = (degree or "").strip().replace("♭", "b").replace("♯", "#")
    if normalized not in DEGREE_TO_SEMITONE or root not in NOTE_TO_PC:
        return ""
    match = re.match(r"^(bb|b|#|)?([1-7])$", normalized)
    if not match:
        return _pc_name(NOTE_TO_PC[root] + DEGREE_TO_SEMITONE[normalized], root)
    root_letter = root[0].upper()
    target_letter = LETTERS[(LETTERS.index(root_letter) + int(match.group(2)) - 1) % 7]
    target_pc = (NOTE_TO_PC[root] + DEGREE_TO_SEMITONE[normalized]) % 12
    natural_pc = LETTER_TO_NATURAL_PC[target_letter]
    diff = (target_pc - natural_pc) % 12
    if diff > 6:
        diff -= 12
    accidental = {-2: "bb", -1: "b", 0: "", 1: "#", 2: "##"}.get(diff)
    return f"{target_letter}{accidental}" if accidental is not None else _pc_name(target_pc, root)

def _is_note_name(value: str) -> bool:
    return bool(value and value[0:1].upper() in "ABCDEFG" and len(value) <= 2 and (len(value) == 1 or value[1] in ("#", "b")))

def _is_slash_alteration(current_quality: str, suffix: str) -> bool:
    """M2TM allows slash-separated alterations (C7/#11) as well as bass notes.

    SongMaster also uses slash degrees for inversions (D/5 -> D/A). Treat
    large extensions and slash suffixes after an existing quality as alterations;
    bare root/degree forms remain bass-degree inversions.
    """
    normalized = (suffix or "").strip().replace("♭", "b").replace("♯", "#")
    quality = (current_quality or "").replace(":", "")
    if re.fullmatch(r"[#b]?(9|11|13)", normalized):
        return True
    if re.fullmatch(r"[#b]5", normalized) and quality:
        return True
    if normalized == "7" and quality:
        return True
    if normalized.startswith(("#", "b")) and quality:
        return True
    return False

def m2tm_chord(chord: str) -> str:
    """Normalize SongMaster chord labels to M2TM Chords-friendly tokens.

    SongMaster writes qualities as e.g. ``Gb:m7`` or ``Ab:sus4``. M2TM accepts
    compact names such as ``Gbm7`` and ``Absus4``. SongMaster often stores
    inversions as degree slash suffixes (``D/5`` or ``Db/b7``); M2TM expects
    real bass-note slash chords, so we translate those to ``D/A`` etc.
    """
    value = (chord or "").strip()
    if not value or value == "N":
        return ""
    root = _chord_root(value)
    if not root:
        return ""
    rest = value[len(root):]
    bass_note = ""
    if "/" in rest:
        parts = rest.split("/")
        rest = parts[0]
        for suffix in parts[1:]:
            if _is_note_name(suffix) and _chord_root(suffix):
                bass_note = suffix
            elif _is_slash_alteration(rest, suffix):
                rest = f"{rest}{suffix}"
            else:
                bass_note = _bass_from_degree(root, suffix) or bass_note
    rest = rest.replace(":", "")
    rest = rest.replace("min", "m")
    rest = rest.replace("mi", "m")
    # M2TM Chords v4.80 supports Cadd9 as a distinct triad + 9th color.
    # Keep add9, but compact less common SongMaster add-extension spelling.
    rest = re.sub(r"add(?=(6|11|13))", "", rest)
    chord_name = f"{root}{rest}"
    return f"{chord_name}/{bass_note}" if bass_note else chord_name

