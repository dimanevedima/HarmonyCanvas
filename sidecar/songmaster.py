"""
Optional, local-only integration with SongMaster Pro (AurallySound) — a
desktop app that detects chords, song structure, and (optionally) separates
stems. Never invoked automatically; only when the user explicitly asks.

SongMaster stores its analysis in plain, readable files under the user's
Documents folder, keyed by the original audio file's absolute path:

    Documents/SongMaster/Songs/<...>/<Song Name>.song   — XML: sections + chords
    Documents/SongMaster/Stems/<...>/<Song Name>.stems/ — folder of stem FLACs

There is no scripting API — automation is limited to what the app itself
supports: opening a file via the command line. Everything else (running
the actual chord/structure detection, saving the project, running the stem
separator) is a manual step in SongMaster's own UI. This module only knows
how to launch the app and, once the user has done that manual step, read
the results back.
"""

import subprocess
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
import re

from types import SimpleNamespace

# Harmony Canvas only imports this module's note/chord helpers.  Keep the
# optional SongMaster functions inert without pulling in ReferenceCompare's
# application settings.
settings = SimpleNamespace(
    songmaster_exe_path=Path(""),
    songmaster_documents_dir=Path(""),
)


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

ROMAN_BY_DIFF = {
    0: "I",
    1: "bII",
    2: "II",
    3: "bIII",
    4: "III",
    5: "IV",
    6: "#IV",
    7: "V",
    8: "bVI",
    9: "VI",
    10: "bVII",
    11: "VII",
}


def exe_path() -> Path | None:
    path = settings.songmaster_exe_path
    return path if path.exists() else None


def open_audio_file(audio_path: str) -> None:
    exe = exe_path()
    if not exe:
        raise FileNotFoundError(f"SongMaster Pro not found at {settings.songmaster_exe_path}")
    target = Path(audio_path).expanduser()
    if not target.exists():
        raise FileNotFoundError(f"Audio file not found: {target}")
    # Fire-and-forget: SongMaster is a GUI app, we don't wait for it to close.
    subprocess.Popen([str(exe), str(target)])


def _iter_song_files() -> list[Path]:
    root = settings.songmaster_documents_dir / "Songs"
    if not root.exists():
        return []
    return list(root.rglob("*.song"))


def find_song_file(audio_path: str) -> Path | None:
    """Locate the .song project file whose audioFilename matches this track."""
    target = str(Path(audio_path).expanduser().resolve())
    for song_file in _iter_song_files():
        try:
            root = ET.parse(song_file).getroot()
        except ET.ParseError:
            continue
        candidate = root.attrib.get("audioFilename", "")
        if candidate and Path(candidate).resolve() == Path(target):
            return song_file
    return None


def find_stems_dir(song_file: Path) -> Path | None:
    """SongMaster mirrors the Songs/<...>/<name>.song path under Stems/<...>/<name>.stems/."""
    songs_root = settings.songmaster_documents_dir / "Songs"
    stems_root = settings.songmaster_documents_dir / "Stems"
    try:
        rel = song_file.relative_to(songs_root)
    except ValueError:
        return None
    stems_dir = stems_root / rel.with_suffix(".stems")
    return stems_dir if stems_dir.is_dir() else None


def _float_attr(element: ET.Element | None, name: str) -> float | None:
    if element is None:
        return None
    try:
        return float(element.attrib.get(name, ""))
    except ValueError:
        return None


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


def _is_minor_chord(chord: str) -> bool:
    after_root = chord[len(_chord_root(chord)):]
    return after_root.startswith(":m") or after_root.startswith("m") or after_root.startswith("-")


def roman_for_chord(chord: str, key: str) -> str:
    root = _chord_root(chord)
    key_root = _chord_root(key)
    if not root or not key_root:
        return ""
    diff = (NOTE_TO_PC[root] - NOTE_TO_PC[key_root]) % 12
    roman = ROMAN_BY_DIFF[diff]
    return roman.lower() if _is_minor_chord(chord) else roman


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


M2TM_DURATION_VALUES = [
    ("w", 4.0),
    ("wd", 6.0),
    ("wt", 8.0 / 3.0),
    ("h", 2.0),
    ("hd", 3.0),
    ("ht", 4.0 / 3.0),
    ("q", 1.0),
    ("qd", 1.5),
    ("qt", 2.0 / 3.0),
    ("e", 0.5),
    ("ed", 0.75),
    ("et", 1.0 / 3.0),
    ("s", 0.25),
    ("sd", 0.375),
    ("st", 1.0 / 6.0),
    ("t", 0.125),
    ("td", 3.0 / 16.0),
    ("tt", 1.0 / 12.0),
]


def m2tm_duration_token(start_sec: float, end_sec: float, bpm: float | None) -> str:
    if not bpm or bpm <= 0:
        return ""
    duration_sec = max(0.0, float(end_sec) - float(start_sec))
    quarters = duration_sec / (60.0 / bpm)
    if quarters <= 0:
        return ""
    token, _ = min(M2TM_DURATION_VALUES, key=lambda item: abs(item[1] - quarters))
    return token


def _compressed_chords(chords: list[dict]) -> list[dict]:
    result: list[dict] = []
    for chord in chords:
        token = m2tm_chord(chord["chord"])
        if not token:
            continue
        if result and result[-1]["m2tm"] == token:
            result[-1]["end_sec"] = chord["end_sec"]
            continue
        result.append({**chord, "m2tm": token})
    return result


def _timed_token(chord: dict, bpm: float | None) -> str:
    duration = m2tm_duration_token(chord["start_sec"], chord["end_sec"], bpm)
    return f"{chord['m2tm']}:{duration}" if duration else chord["m2tm"]


def _section_progressions(sections: list[dict], chords: list[dict], key: str, bpm: float | None) -> list[dict]:
    progressions = []
    compressed = _compressed_chords(chords)
    for section in sections:
        section_chords = [
            chord for chord in compressed
            if chord["start_sec"] < section["end_sec"] and chord["end_sec"] > section["start_sec"]
        ]
        tokens = [chord["m2tm"] for chord in section_chords]
        timed_tokens = [_timed_token(chord, bpm) for chord in section_chords]
        roman = [roman_for_chord(chord["chord"], key) for chord in section_chords]
        progressions.append({
            **section,
            "chords": [chord["chord"] for chord in section_chords],
            "m2tm": " ".join(tokens),
            "m2tm_timed": " ".join(timed_tokens),
            "roman": " ".join(item for item in roman if item),
            "chord_count": len(tokens),
        })
    return progressions


def _pattern_candidates(chords: list[dict], key: str, limit: int = 8) -> list[dict]:
    tokens = [chord["m2tm"] for chord in _compressed_chords(chords)]
    if len(tokens) < 2:
        return []
    counter: Counter[tuple[str, ...]] = Counter()
    for size in (2, 3, 4, 5, 6, 8):
        for index in range(0, len(tokens) - size + 1):
            window = tuple(tokens[index:index + size])
            if len(set(window)) > 1:
                counter[window] += 1
    ranked = sorted(counter.items(), key=lambda item: (item[1], len(item[0])), reverse=True)
    candidates = []
    key_root = _chord_root(key)
    for pattern, count in ranked:
        if count < 2 and len(candidates) >= 3:
            continue
        roman = [roman_for_chord(chord, key_root) for chord in pattern]
        candidates.append({
            "m2tm": " ".join(pattern),
            "roman": " ".join(item for item in roman if item),
            "count": count,
            "length": len(pattern),
        })
        if len(candidates) >= limit:
            break
    return candidates


def parse_song_file(song_file: Path) -> dict:
    root = ET.parse(song_file).getroot()
    tonal_el = root.find(".//Tonal")
    beats_el = root.find(".//Beats")
    time_sig_el = root.find(".//TimeSigs/Marker")
    key = tonal_el.attrib.get("Key", "") if tonal_el is not None else ""
    sections = []
    for marker in root.findall(".//SectionTimings/Marker"):
        sections.append({
            "start_sec": float(marker.attrib.get("startTime", 0)),
            "end_sec": float(marker.attrib.get("endTime", 0)),
            "label": marker.attrib.get("markerText", ""),
            "bars": int(float(marker.attrib.get("numBars", 0) or 0)),
        })
    chords = []
    for marker in root.findall(".//Chords/Marker"):
        chords.append({
            "start_sec": float(marker.attrib.get("startTime", 0)),
            "end_sec": float(marker.attrib.get("endTime", 0)),
            "chord": marker.attrib.get("markerText", ""),
        })
    filtered_chords = [c for c in chords if c["chord"] != "N"]
    bpm = _float_attr(beats_el, "AvgBpm") or _float_attr(beats_el, "Bpm")
    progressions = _section_progressions(sections, filtered_chords, key, bpm)
    patterns = _pattern_candidates(filtered_chords, key)
    return {
        "song_name": root.attrib.get("songName", ""),
        "artist": root.attrib.get("artistNameMeta", ""),
        "key": key,
        "real_key": tonal_el.attrib.get("RealKey", "") if tonal_el is not None else "",
        "estimated_bpm": bpm,
        "audio_length_sec": _float_attr(beats_el, "audioLength"),
        "time_signature": time_sig_el.attrib.get("markerText", "") if time_sig_el is not None else "",
        "estimated_tuning_hz": _float_attr(tonal_el, "EstimatedTuning"),
        "estimated_cents_off": _float_attr(tonal_el, "EstimatedCentsOff"),
        "sections": sections,
        "chords": filtered_chords,  # "N" = no chord detected
        "section_progressions": progressions,
        "progression_candidates": patterns,
    }


def lookup(audio_path: str) -> dict | None:
    """Full lookup: parsed song data plus stems folder, or None if SongMaster
    has no project for this track yet."""
    song_file = find_song_file(audio_path)
    if not song_file:
        return None
    data = parse_song_file(song_file)
    stems_dir = find_stems_dir(song_file)
    data["stems"] = (
        [str(p) for p in sorted(stems_dir.glob("*.flac")) + sorted(stems_dir.glob("*.wav"))]
        if stems_dir else []
    )
    return data
