from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path


NOTE_PC = {"C": 0, "C#": 1, "DB": 1, "D": 2, "D#": 3, "EB": 3, "E": 4, "F": 5, "F#": 6, "GB": 6, "G": 7, "G#": 8, "AB": 8, "A": 9, "A#": 10, "BB": 10, "B": 11}
PC_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
PC_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
MODE_INTERVALS = {
    "major": [0, 2, 4, 5, 7, 9, 11], "ionian": [0, 2, 4, 5, 7, 9, 11],
    "dorian": [0, 2, 3, 5, 7, 9, 10], "phrygian": [0, 1, 3, 5, 7, 8, 10],
    "lydian": [0, 2, 4, 6, 7, 9, 11], "mixolydian": [0, 2, 4, 5, 7, 9, 10],
    "minor": [0, 2, 3, 5, 7, 8, 10], "aeolian": [0, 2, 3, 5, 7, 8, 10],
    "locrian": [0, 1, 3, 5, 6, 8, 10],
    "harmonic_minor": [0, 2, 3, 5, 7, 8, 11], "phrygian_dominant": [0, 1, 4, 5, 7, 8, 10],
}
MODE_NAMES = {"major": "ионийский", "minor": "эолийский", "ionian": "ионийский", "aeolian": "эолийский", "dorian": "дорийский", "phrygian": "фригийский", "lydian": "лидийский", "mixolydian": "миксолидийский", "locrian": "локрийский", "harmonic_minor": "гармонический минор", "phrygian_dominant": "фригийский доминантовый"}
ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII"]
ANALYSIS_MODES = ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian"]


@lru_cache(maxsize=1)
def catalog() -> dict:
    path = Path(__file__).parent / "data" / "composer" / "advisor_catalog.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _root_pc(name: str) -> int | None:
    return NOTE_PC.get(name.upper())


# ── Structured chord model ──────────────────────────────────────────────────
# A chord is (root, base triad, type, seventh flavour, options, bass). The text
# symbol is derived from that state and never parsed back into a decision, so a
# round trip through the editor cannot silently rewrite the harmony.

CHORD_TYPES = ["triad", "7", "9", "11", "13"]
TYPE_TOP = {"triad": 5, "7": 7, "9": 9, "11": 11, "13": 13}
BASE_TRIAD = {"maj": (4, 7), "min": (3, 7), "dim": (3, 6), "aug": (4, 8)}
# Ordered for symbol composition, not for parsing.
OPTION_IDS = ["sus2", "sus4", "6", "add9", "add11", "add13", "b5", "#5", "b9", "#9", "#11", "b13", "no3", "no5"]
ALTERATIONS = (("b9", 14, 13), ("#9", 14, 15), ("#11", 17, 18), ("b13", 21, 20))


def option_availability(chord_type: str, inversion: int | None = None) -> dict[str, bool]:
    """An option is offered only where it still changes the chord.

    add9 on a 7th chord would just be a 9th chord, and b13 on a 13th chord
    would alter a tone the type already names, so both are withheld. A tone
    standing in the bass cannot be dropped either, so an inversion locks the
    matching `no3` or `no5`.
    """
    top = TYPE_TOP[chord_type]
    return {
        "sus2": top <= 7 and inversion != 1, "sus4": top <= 7 and inversion != 1, "6": top <= 5,
        "add9": top <= 5, "add11": top <= 7, "add13": top <= 9,
        "b9": top >= 7 and top != 9, "#9": top >= 7 and top != 9,
        "#11": top >= 7 and top != 11, "b13": top >= 7 and top != 13,
        "b5": True, "#5": True,
        "no3": inversion != 1, "no5": inversion != 2,
    }


def inversion_availability(chord_type: str) -> list[bool]:
    """Root position, plus the inversions that have a distinct bass tone.

    Hookpad only inverts triads and sevenths, but an extended chord inverts
    just as well, so the third and fifth stay available and only the seventh
    in the bass needs a seventh to exist.
    """
    return [True, True, True, chord_type != "triad"]


def split_quality(quality: str) -> dict:
    """Read a written chord quality into structured state."""
    lower = quality.strip().replace("♭", "b").replace("♯", "#").replace("Δ", "maj").replace("(", "").replace(")", "").lower()
    options = []
    for token in sorted(OPTION_IDS, key=len, reverse=True):
        if token in lower:
            options.append(token)
            lower = lower.replace(token, "", 1)
    if "sus" in lower:
        options.append("sus4")
        lower = lower.replace("sus", "", 1)
    if "dim" in lower or "°" in lower: base = "dim"
    elif "aug" in lower or "+" in lower: base = "aug"
    elif lower.startswith("m") and not lower.startswith("maj"): base = "min"
    else: base = "maj"
    found = re.findall(r"13|11|9|7", lower)
    chord_type = found[0] if found else "triad"
    seventh = "maj" if "maj" in lower else None
    if chord_type != "triad" and seventh is None:
        seventh = "dim" if base == "dim" else "dom"
    return {"base": base, "type": chord_type, "seventh": seventh, "options": [item for item in OPTION_IDS if item in options]}


def state_intervals(state: dict) -> list[int]:
    """Semitones above the root that the chord state actually sounds."""
    third, fifth = BASE_TRIAD[state["base"]]
    intervals = [0, third, fifth]
    top = TYPE_TOP[state["type"]]
    seventh = state.get("seventh")
    if top >= 7: intervals.append(9 if seventh == "dim" else 11 if seventh == "maj" else 10)
    if top >= 9: intervals.append(14)
    if top >= 11: intervals.append(17)
    if top >= 13: intervals.append(21)
    marks = set(state.get("options") or [])
    if "sus2" in marks or "sus4" in marks:
        intervals = [item for item in intervals if item != third]
        intervals.append(2 if "sus2" in marks else 5)
    if "6" in marks: intervals.append(9)
    if "add9" in marks: intervals.append(14)
    if "add11" in marks: intervals.append(17)
    if "add13" in marks: intervals.append(21)
    for token, natural, altered in ALTERATIONS:
        if token in marks:
            intervals = [item for item in intervals if item != natural]
            intervals.append(altered)
    if "b5" in marks or "#5" in marks:
        intervals = [item for item in intervals if item % 12 != fifth % 12]
        intervals.append(6 if "b5" in marks else 8)
    if "no3" in marks: intervals = [item for item in intervals if item % 12 not in {3, 4}]
    if "no5" in marks: intervals = [item for item in intervals if item % 12 not in {6, 7, 8}]
    return sorted(dict.fromkeys(intervals))


def compose_symbol(state: dict) -> str:
    """Render chord state back to text. The inverse of `split_quality`."""
    base, chord_type, seventh = state["base"], state["type"], state.get("seventh")
    body = {"maj": "", "min": "m", "dim": "dim", "aug": "aug"}[base]
    if chord_type != "triad":
        if seventh == "maj": body += ("Maj" if base == "min" else "maj") + chord_type
        else: body += chord_type
    marks = "".join(token for token in OPTION_IDS if token in (state.get("options") or []))
    root = state["root"]
    if marks.startswith("b") and not body and len(root) == 1:
        # `Fb5` would read as F-flat; parenthesise so the flat belongs to the fifth.
        body = f"({marks})"
    else:
        body += marks
    bass = state.get("bass") or root
    return f"{root}{body}{'/' + bass if bass != root else ''}"


def chord_quality_suffix(state: dict) -> str:
    """Extension label used by roman numerals, e.g. `maj13` in `VImaj13`."""
    if state["type"] == "triad":
        return "6" if "6" in (state.get("options") or []) else ""
    return ("maj" if state.get("seventh") == "maj" else "") + state["type"]


def parse_chord(symbol: str) -> dict | None:
    clean = symbol.strip().replace("♭", "b").replace("♯", "#")
    match = re.match(r"^([A-Ga-g])([#b]?)([^/\s]*)(?:/([A-Ga-g][#b]?))?$", clean)
    if not match:
        return None
    root = match.group(1).upper() + match.group(2)
    quality = match.group(3) or ""
    bass = match.group(4) or root
    root_pc = _root_pc(root)
    bass_pc = _root_pc(bass)
    if root_pc is None or bass_pc is None:
        return None
    state = split_quality(quality)
    state["root"] = root
    state["bass"] = bass
    intervals = state_intervals(state)
    inversion = next((index for index, step in enumerate(intervals[:4]) if (root_pc + step) % 12 == bass_pc), None)
    state["inversion"] = inversion
    notes = [48 + bass_pc]
    notes.extend(60 + root_pc + interval for interval in intervals)
    notes = sorted(dict.fromkeys(n if n < 84 else n - 12 for n in notes))
    names = PC_FLAT if "b" in root else PC_SHARP
    tone_names = [names[(root_pc + interval) % 12] for interval in intervals]
    return {
        "symbol": clean, "root": root, "root_pc": root_pc, "bass": bass, "bass_pc": bass_pc,
        "quality": quality, "midi": notes, "tone_names": tone_names, "state": state,
        "options_available": option_availability(state["type"], inversion),
        "inversions_available": inversion_availability(state["type"]),
    }


def parse_progression(text: str) -> list[dict]:
    tokens = [item for item in re.split(r"\s*(?:→|—|–|\||,|;)\s*|\s+", text.strip()) if item]
    return [chord for token in tokens if (chord := parse_chord(token))]


def _degree(root_pc: int, tonic_pc: int, intervals: list[int]) -> tuple[str, int]:
    distance = (root_pc - tonic_pc) % 12
    if distance in intervals:
        index = intervals.index(distance)
        return ROMANS[index], index
    closest = min(range(7), key=lambda i: min((distance - intervals[i]) % 12, (intervals[i] - distance) % 12))
    delta = (distance - intervals[closest]) % 12
    accidental = "#" if delta == 1 else "b" if delta == 11 else "•"
    return accidental + ROMANS[closest], closest


# Semitones above the target degree, plus the quality the secondary chord takes.
SECONDARY_STEPS = {"V": (7, "maj", "dom"), "IV": (5, "maj", "maj"), "vii": (11, "dim", "dim")}


def _degree_interval(intervals: list[int], degree: int, step: int) -> int:
    """Semitones from a scale degree up to the tone `step` scale steps above it."""
    index = degree + step
    return (intervals[index % 7] + 12 * (index // 7) - intervals[degree]) % 12


def degree_state(tonic_pc: int, intervals: list[int], degree: int, flats: bool, template: dict | None = None) -> dict:
    """Build the chord state for a scale degree, in the shape of a template chord.

    The template carries the type and inversion of whatever chord is selected in
    the editor, so the palette offers "the same chord, one degree over" rather
    than a fixed row of triads.
    """
    template = template or {}
    names = PC_FLAT if flats else PC_SHARP
    root_pc = (tonic_pc + intervals[degree]) % 12
    third = _degree_interval(intervals, degree, 2)
    fifth = _degree_interval(intervals, degree, 4)
    seventh = _degree_interval(intervals, degree, 6)
    base = "dim" if (third, fifth) == (3, 6) else "aug" if (third, fifth) == (4, 8) else "min" if third == 3 else "maj"
    chord_type = template.get("type") or "triad"
    # Options carry across the whole palette: checking b5 on one chord offers
    # every degree with a flat five, the way the type and inversion already do.
    wanted = set(template.get("options") or [])
    if base == "dim" and chord_type != "triad" and seventh == 10:
        # A diminished triad under a minor seventh is half-diminished, m7b5 —
        # not the fully diminished dim7 that a bare "dim" prefix would spell.
        base, wanted = "min", wanted | {"b5"}
    elif base == "dim" and "b5" in wanted:
        base = "min"    # the flat five already supplies the diminished fifth
    elif base == "aug" and "#5" in wanted:
        base = "maj"
    available = option_availability(chord_type, template.get("inversion"))
    quality_seventh = {11: "maj", 10: "dom", 9: "dim"}.get(seventh, "dom")
    secondary = template.get("secondary")
    if secondary in SECONDARY_STEPS:
        # A secondary chord points at this degree instead of being it: V/ii is
        # the dominant of the second degree, not the second degree itself. Its
        # root is a raised alteration, so it is spelled sharp — the leading tone
        # of D is C#, never Db.
        step, secondary_base, secondary_seventh = SECONDARY_STEPS[secondary]
        root_pc = (root_pc + step) % 12
        if secondary in {"V", "vii"}:
            names = PC_SHARP    # a dominant or leading tone reads as raised

        base, quality_seventh = secondary_base, secondary_seventh
        wanted = {item for item in wanted if item not in {"b5", "#5"}}
    state = {
        "root": names[root_pc], "base": base,
        "type": chord_type,
        "seventh": quality_seventh,
        "options": [item for item in OPTION_IDS if item in wanted and available.get(item)],
        "inversion": None,
    }
    state["bass"] = state["root"]
    inversion = template.get("inversion")
    if inversion:
        steps = state_intervals(state)
        if inversion < len(steps):
            state["bass"] = names[(root_pc + steps[inversion]) % 12]
            state["inversion"] = inversion
    else:
        state["inversion"] = 0
    return state


def _diatonic_chord(tonic_pc: int, intervals: list[int], degree: int, flats: bool) -> str:
    return compose_symbol(degree_state(tonic_pc, intervals, degree, flats))


def _triad_quality(chord: dict) -> str:
    state = chord["state"]
    if {"sus2", "sus4"} & set(state.get("options") or []): return "sus"
    return state["base"]


def _quality_roman(base: str, chord: dict) -> str:
    """`vi`, `ii°`, `VImaj13`, `i(b5)` — the degree with its quality and colour.

    A suspension hides the third but must not hide which degree this is, so the
    numeral keeps the case of the underlying triad and the options are appended
    the way Hookpad shows them.
    """
    accidental = base[:-len(base.lstrip("#b•"))] if base[:1] in "#b•" else ""
    numeral = base[len(accidental):]
    state = chord["state"]
    quality = state["base"]
    if quality == "min": numeral = numeral.lower()
    elif quality == "dim": numeral = numeral.lower() + "°"
    elif quality == "aug": numeral += "+"
    options = state.get("options") or []
    colour = f"({''.join(item for item in OPTION_IDS if item in options)})" if options else ""
    return accidental + numeral + chord_quality_suffix(state) + colour


def _triad_intervals(chord: dict) -> list[int]:
    quality = _triad_quality(chord)
    return {"maj": [0, 4, 7], "min": [0, 3, 7], "dim": [0, 3, 6], "aug": [0, 4, 8], "sus": [0, 5, 7]}[quality]


def _mode_chord_quality(intervals: list[int], degree: int) -> str:
    third = _degree_interval(intervals, degree, 2)
    fifth = _degree_interval(intervals, degree, 4)
    return "dim" if (third, fifth) == (3, 6) else "min" if third == 3 else "maj"


def _infer_keys(chords: list[dict], flats: bool) -> list[dict]:
    if not chords:
        return []
    names = PC_FLAT if flats else PC_SHARP
    hypotheses = []
    for tonic_pc in range(12):
        for mode in ANALYSIS_MODES:
            intervals = MODE_INTERVALS[mode]
            scale = {(tonic_pc + step) % 12 for step in intervals}
            score = 0.0
            diatonic_roots = 0
            matched_triads = 0
            for chord in chords:
                distance = (chord["root_pc"] - tonic_pc) % 12
                if chord["root_pc"] in scale:
                    score += 2.0
                    diatonic_roots += 1
                    degree = intervals.index(distance)
                    if _triad_quality(chord) == _mode_chord_quality(intervals, degree):
                        score += 2.0
                        matched_triads += 1
                score += sum(1.0 for step in _triad_intervals(chord) if (chord["root_pc"] + step) % 12 in scale)
            tonic_hits = sum(chord["root_pc"] == tonic_pc for chord in chords)
            score += tonic_hits * 1.5
            if chords[0]["root_pc"] == tonic_pc: score += 1.5
            if chords[-1]["root_pc"] == tonic_pc: score += 3.0
            max_score = len(chords) * 8.5 + 4.5
            hypotheses.append({
                "tonic": names[tonic_pc], "tonic_pc": tonic_pc, "mode": mode,
                "label": f"{names[tonic_pc]} {MODE_NAMES[mode]}",
                "score": round(score / max_score, 3),
                "diatonic_chords": diatonic_roots, "quality_matches": matched_triads,
                "evidence": f"{diatonic_roots}/{len(chords)} корней и {matched_triads}/{len(chords)} качеств поддерживают гипотезу",
            })
    hypotheses.sort(key=lambda item: (item["score"], item["quality_matches"], item["diatonic_chords"]), reverse=True)
    return hypotheses[:3]


# ── Melody: MIDI pitch is stored, the scale degree is derived ───────────────
# A degree plus an accidental covers all twelve semitones, so the two are the
# same information. Keeping the pitch means MIDI import and Ableton round trip
# without rounding, while the degree is recomputed whenever the key changes.

DEFAULT_CHORD_BEATS = 4.0
MIN_TIMELINE_BARS = 16


def note_to_midi(value, default_octave: int = 4) -> int | None:
    """Read a pitch from a MIDI number or a name like `F#4`, `Bb`, `C`."""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = int(value)
        return number if 0 <= number <= 127 else None
    match = re.match(r"^\s*([A-Ga-g])([#b♯♭]?)(-?\d+)?\s*$", str(value or ""))
    if not match:
        return None
    pc = NOTE_PC.get((match.group(1) + match.group(2).replace("♯", "#").replace("♭", "b")).upper())
    if pc is None:
        return None
    octave = int(match.group(3)) if match.group(3) is not None else default_octave
    number = (octave + 1) * 12 + pc
    return number if 0 <= number <= 127 else None


def degree_label(distance: int, intervals: list[int]) -> str:
    """`3` for a scale tone, `#4/b5` for the semitones in between."""
    if distance in intervals:
        return str(intervals.index(distance) + 1)
    below = max(index for index, step in enumerate(intervals) if step < distance)
    return f"#{below + 1}/b{(below + 1) % 7 + 1}"


def degree_position(distance: int, intervals: list[int]) -> int | None:
    """Scale degree as a 0-based index, or None for a chromatic step."""
    return intervals.index(distance) if distance in intervals else None


def melody_grid(tonic_pc: int, intervals: list[int], flats: bool, *, chromatic: bool = False, low: int = 55, high: int = 84) -> list[dict]:
    """Rows for the note grid, high pitch first, ready for a piano roll."""
    names = PC_FLAT if flats else PC_SHARP
    rows = []
    for midi in range(high, low - 1, -1):
        distance = (midi - tonic_pc) % 12
        in_scale = distance in intervals
        if not chromatic and not in_scale:
            continue
        rows.append({
            "midi": midi,
            "name": f"{names[midi % 12]}{midi // 12 - 1}",
            "pitch_class": midi % 12,
            "degree": degree_label(distance, intervals),
            "degree_index": degree_position(distance, intervals),
            "in_scale": in_scale,
        })
    return rows


def normalise_melody(raw: list[dict] | None) -> list[dict]:
    """Bring stored notes to `{pitch, start, duration, voice}` in beats.

    A given `start` is always trusted; only a note without one is laid after
    the previous note, which is how the old text field wrote them.
    """
    notes = []
    cursor = 0.0
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        pitch = note_to_midi(item.get("pitch"))
        if pitch is None:
            continue
        duration = max(0.125, float(item.get("duration") or 1))
        raw_start = item.get("start")
        try:
            start = cursor if raw_start is None else max(0.0, float(raw_start))
        except (TypeError, ValueError):
            start = cursor
        notes.append({"pitch": pitch, "start": round(start, 4), "duration": round(duration, 4), "voice": int(item.get("voice") or 1)})
        cursor = round(start + duration, 4)
    return sorted(notes, key=lambda note: (note["start"], note["pitch"]))


def apply_note_edit(melody: list[dict] | None, *, op: str, index: int | None = None, pitch=None, start=None, duration=None, voice=None) -> tuple[list[dict], int]:
    """Apply one melody edit and report which note stays selected.

    Notes are kept sorted by position, so the index is recomputed against the
    edited note rather than assumed to survive the operation.
    """
    notes = normalise_melody(melody)
    if op == "clear":
        return [], -1

    if op == "add":
        number = note_to_midi(pitch)
        if number is None:
            return notes, -1
        target = {
            "pitch": number,
            "start": round(max(0.0, float(start or 0)), 4),
            "duration": round(max(0.125, float(duration or 1)), 4),
            "voice": int(voice or 1),
        }
        notes.append(target)
    elif index is None or not 0 <= index < len(notes):
        return notes, -1
    elif op == "delete":
        notes.pop(index)
        return notes, min(index, len(notes) - 1)
    else:
        target = notes[index]
        if op == "move":
            number = note_to_midi(pitch)
            if number is not None:
                target["pitch"] = number
            if start is not None:
                target["start"] = round(max(0.0, float(start)), 4)
        elif op == "resize":
            target["duration"] = round(max(0.125, float(duration)), 4)
        elif op == "voice":
            target["voice"] = int(voice or 1)
        else:
            return notes, index

    notes.sort(key=lambda note: (note["start"], note["pitch"]))
    return notes, notes.index(target)


def _lengths(beats: list[float] | None, count: int) -> list[float]:
    result = []
    for index in range(count):
        try:
            result.append(max(0.25, float(beats[index])) if beats and index < len(beats) else DEFAULT_CHORD_BEATS)
        except (TypeError, ValueError):
            result.append(DEFAULT_CHORD_BEATS)
    return result


def _positions(starts: list[float] | None, lengths: list[float]) -> list[float]:
    """Explicit starts win; anything missing follows the previous chord."""
    result = []
    cursor = 0.0
    for index, length in enumerate(lengths):
        try:
            start = max(0.0, float(starts[index])) if starts and index < len(starts) and starts[index] is not None else cursor
        except (TypeError, ValueError):
            start = cursor
        result.append(round(start, 4))
        cursor = round(start + length, 4)
    return result


def place_chords(chords: list[dict], beats: list[float] | None, starts: list[float] | None = None) -> None:
    """Give every chord a start and a length so it can sit on a bar grid."""
    lengths = _lengths(beats, len(chords))
    positions = _positions(starts, lengths)
    for chord, start, length in zip(chords, positions, lengths):
        chord["start"] = start
        chord["beats"] = round(length, 4)


def annotate_melody(notes: list[dict], chords: list[dict], tonic_pc: int, intervals: list[int], flats: bool) -> list[dict]:
    """Attach the degree and whether each note belongs to the chord under it."""
    names = PC_FLAT if flats else PC_SHARP
    annotated = []
    for note in notes:
        distance = (note["pitch"] - tonic_pc) % 12
        chord = next((item for item in chords if item["start"] <= note["start"] < item["start"] + item["beats"]), None)
        chord_tones = {midi % 12 for midi in chord["midi"]} if chord else set()
        annotated.append({
            **note,
            "name": f"{names[note['pitch'] % 12]}{note['pitch'] // 12 - 1}",
            "degree": degree_label(distance, intervals),
            "degree_index": degree_position(distance, intervals),
            "in_scale": distance in intervals,
            "chord_tone": (note["pitch"] % 12) in chord_tones,
            "chord_symbol": chord["symbol"] if chord else None,
        })
    return annotated


@lru_cache(maxsize=1)
def catalog_statistics() -> dict:
    """Frequency priors mined from the 189 PTM catalogue progressions.

    `overall` is how often each (offset, quality) appears at all; `transitions`
    is how often one follows another. Catalogue entries are cyclic, so the last
    chord is counted as leading back into the first.
    """
    from collections import Counter, defaultdict
    overall: Counter = Counter()
    transitions: dict = defaultdict(Counter)
    try:
        from sidecar import ptm_analysis
        entries = ptm_analysis.catalog()
    except Exception:
        # The Lab stays usable when an optional knowledge provider is unavailable.
        return {"overall": Counter(), "transitions": {}, "entries": 0}
    for entry in entries:
        steps = [tuple(step) for step in entry["steps"]]
        overall.update(steps)
        followers = steps[1:] + steps[:1] if entry.get("cyclic") else steps[1:]
        for left, right in zip(steps, followers):
            transitions[left][right] += 1
    return {"overall": overall, "transitions": dict(transitions), "entries": len(entries)}


QUALITY_SUFFIX = {"maj": "", "min": "m", "dim": "dim", "aug": "aug", "sus4": "sus4"}


def _weighted_chords(counter, tonic_pc: int, intervals: list[int], flats: bool, limit: int) -> list[dict]:
    """Turn catalogue counts into playable chords, ranked and normalised."""
    if not counter:
        return []
    rows = counter.most_common(limit)
    top = rows[0][1] or 1
    chords = []
    for (offset, quality), count in rows:
        # bII, bIII, bVI and bVII read as flats even in a sharp key.
        names = PC_FLAT if flats or offset in {1, 3, 8, 10} else PC_SHARP
        symbol = names[(tonic_pc + offset) % 12] + QUALITY_SUFFIX.get(quality, "")
        parsed = parse_chord(symbol)
        if not parsed:
            continue
        degree, degree_index = _degree(parsed["root_pc"], tonic_pc, intervals)
        chords.append({
            "symbol": symbol,
            "degree": _quality_roman(degree, parsed),
            "degree_index": degree_index,
            "weight": round(100 * count / top),
            "count": count,
            "midi": parsed["midi"],
        })
    return chords


def _prefers_flats(tonic: str, tonic_pc: int, mode_key: str) -> bool:
    minor_ish = mode_key in {"minor", "aeolian", "dorian", "phrygian", "locrian"}
    return "b" in tonic or tonic_pc in {1, 3, 5, 8, 10} or (minor_ish and tonic_pc in {0, 2, 5, 7, 10})


def _mode_context(tonic: str, mode: str) -> tuple[int, list[int], bool]:
    tonic_pc = _root_pc(tonic) if tonic else 0
    tonic_pc = 0 if tonic_pc is None else tonic_pc
    mode_key = (mode or "major").lower()
    intervals = MODE_INTERVALS.get(mode_key, MODE_INTERVALS["major"])
    return tonic_pc, intervals, _prefers_flats(tonic, tonic_pc, mode_key)


def apply_chord_edit(chord_input: str, *, index: int, op: str, value: str = "", tonic: str = "C", mode: str = "major", chord_beats: list[float] | None = None, chord_starts: list[float] | None = None) -> tuple[str, int, list[float], list[float]]:
    """Apply one editor operation to a progression.

    Returns the rewritten progression text, the index to keep selected, and the
    chord lengths kept in step with it. All chord property edits go through the
    structured state, so nothing is decided by re-reading a symbol we just wrote.
    """
    tokens = [item for item in re.split(r"\s*(?:→|—|–|\||,|;)\s*|\s+", chord_input.strip()) if item]
    beats = _lengths(chord_beats, len(tokens))
    starts = _positions(chord_starts, beats)
    tonic_pc, intervals, flats = _mode_context(tonic, mode)

    def result(selected: int) -> tuple[str, int, list[float], list[float]]:
        return " ".join(tokens), max(0, min(selected, max(0, len(tokens) - 1))), beats, starts

    def reflow(from_index: int = 0) -> None:
        """Lay the lane out end to end from a point on.

        Only the ops that mean "rebuild the sequence" use this. Positions are
        otherwise absolute: deleting a chord leaves its gap rather than dragging
        everything left under the author's feet.
        """
        cursor = starts[from_index] if from_index < len(starts) else 0.0
        for position in range(from_index, len(tokens)):
            starts[position] = round(cursor, 4)
            cursor = round(cursor + beats[position], 4)

    if op == "insert":
        at = index + 1 if tokens else 0
        tokens.insert(at, value)
        beats.insert(at, beats[index] if index < len(beats) else DEFAULT_CHORD_BEATS)
        starts.insert(at, starts[index] + beats[index] if index < len(starts) else 0.0)
        reflow(at)
        return result(at)
    if not tokens or not 0 <= index < len(tokens):
        return result(index)
    if op == "delete":
        tokens.pop(index)
        beats.pop(index)
        starts.pop(index)
        return result(index)
    if op == "move":
        target = max(0, min(int(value), len(tokens) - 1))
        tokens.insert(target, tokens.pop(index))
        beats.insert(target, beats.pop(index))
        starts.insert(target, starts.pop(index))
        reflow(min(index, target))
        return result(target)
    if op == "position":
        # Free placement: the chord keeps the beat it was dropped on, and the
        # lane is re-read in time order so the progression still reads left to right.
        starts[index] = max(0.0, float(value))
        order = sorted(range(len(tokens)), key=lambda item: (starts[item], item))
        tokens = [tokens[item] for item in order]
        beats = [beats[item] for item in order]
        starts = [starts[item] for item in order]
        return result(order.index(index))
    if op == "duration":
        beats[index] = max(0.25, float(value))
        return result(index)
    if op == "symbol":
        clean = value.strip().replace(" ", "")
        if not clean:
            tokens.pop(index)
            beats.pop(index)
            return result(index)
        tokens[index] = clean
        return result(index)

    chord = parse_chord(tokens[index])
    if chord is None:
        return result(index)
    state = dict(chord["state"])
    state["options"] = list(state.get("options") or [])
    degree = _degree(chord["root_pc"], tonic_pc, intervals)[1]

    if op == "reset":
        tokens[index] = _diatonic_chord(tonic_pc, intervals, degree, flats)
        return result(index)
    if op == "borrow":
        # Borrowing swaps the mode the degree is read in; it must not throw away
        # the type, the extensions or the inversion the chord already had.
        borrowed = MODE_INTERVALS.get(value, MODE_INTERVALS["minor"])
        lent = degree_state(tonic_pc, borrowed, degree, flats, {"type": state["type"], "inversion": state.get("inversion")})
        available = option_availability(lent["type"], lent.get("inversion"))
        # Keep both what the borrowed degree needs (a b5 makes it half-diminished)
        # and what the author had already chosen.
        wanted = set(lent["options"]) | set(state["options"])
        lent["options"] = [item for item in OPTION_IDS if item in wanted and available.get(item)]
        tokens[index] = compose_symbol(lent)
        return result(index)
    if op == "secondary":
        if value not in SECONDARY_STEPS:
            return result(index)
        # Built from the diatonic degree, not the current root, so applying the
        # same secondary twice cannot stack into V/V/V.
        secondary = degree_state(tonic_pc, intervals, degree, flats, {
            "type": state["type"], "inversion": state.get("inversion"),
            "options": state["options"], "secondary": value,
        })
        tokens[index] = compose_symbol(secondary)
        return result(index)
    if op == "type":
        state["type"] = value if value in CHORD_TYPES else "triad"
        if state["type"] == "triad":
            state["seventh"] = None
        elif state.get("seventh") is None:
            # Follow the mode, the way a diatonic seventh would be spelled here.
            state["seventh"] = "dim" if state["base"] == "dim" else "maj" if _mode_seventh_is_major(intervals, degree) else "dom"
        state["options"] = [item for item in state["options"] if option_availability(state["type"]).get(item)]
    elif op == "quality":
        state["base"] = value if value in BASE_TRIAD else "maj"
        if state["type"] != "triad" and state["base"] == "dim" and state.get("seventh") == "dom":
            state["seventh"] = "dim"
    elif op == "seventh":
        state["seventh"] = "maj" if value == "maj" else "dom"
    elif op == "inversion":
        wanted = None if value in {"", "none"} else int(value)
        steps = state_intervals(state)
        names = PC_FLAT if "b" in state["root"] else PC_SHARP
        state["bass"] = state["root"] if wanted in (None, 0) else names[(chord["root_pc"] + steps[wanted]) % 12] if wanted < len(steps) else state["root"]
    elif op == "option":
        name, _, flag = value.partition(":")
        options = set(state["options"])
        if flag == "1":
            options.add(name)
            for left, right in (("sus2", "sus4"), ("b5", "#5"), ("b9", "#9")):
                if name == left: options.discard(right)
                if name == right: options.discard(left)
        else:
            options.discard(name)
        state["options"] = [item for item in OPTION_IDS if item in options and option_availability(state["type"], state.get("inversion")).get(item)]

    if op != "inversion":
        # An inversion means "the Nth chord tone is in the bass", so after the
        # chord changes shape the bass has to be read off the new tones. A bass
        # that was never a chord tone is a deliberate slash and stays put.
        held = chord["state"].get("inversion")
        if held is not None:
            steps = state_intervals(state)
            names = PC_FLAT if "b" in state["root"] else PC_SHARP
            state["bass"] = names[(chord["root_pc"] + steps[held]) % 12] if held < len(steps) else state["root"]

    tokens[index] = compose_symbol(state)
    return result(index)


def _mode_seventh_is_major(intervals: list[int], degree: int) -> bool:
    seventh = (intervals[(degree + 6) % 7] + (12 if degree + 6 >= 7 else 0) - intervals[degree]) % 12
    return seventh == 11


def _arrangement_move(chords: list[dict]) -> dict:
    """Pick the development move from the material itself, not from a mood switch.

    A dense progression needs room, a two-chord loop needs a second voice, and
    everything in between benefits from a change of register.
    """
    moves = {item["id"]: item for item in catalog()["arrangement"]}
    distinct = len({chord["symbol"] for chord in chords})
    if distinct >= 5: return moves["subtract"]
    if distinct <= 2: return moves["redistribute"]
    return moves["register"]


def _borrowed_symbol(tonic_pc: int, offset: int, suffix: str, flats: bool) -> str:
    return (PC_FLAT if flats else PC_SHARP)[(tonic_pc + offset) % 12] + suffix


def analyze_sketch(*, chord_input: str, tonic: str, mode: str, melody: list[dict] | None = None, selected_index: int | None = None, palette_mode: str | None = None, palette_secondary: str | None = None, chord_beats: list[float] | None = None, chord_starts: list[float] | None = None, chromatic: bool = False, meter: str = "4/4") -> dict:
    mode_key = (mode or "major").lower()
    tonic_pc, intervals, flats = _mode_context(tonic, mode_key)
    chords = parse_progression(chord_input)
    place_chords(chords, chord_beats, chord_starts)
    for chord in chords:
        degree, index = _degree(chord["root_pc"], tonic_pc, intervals)
        chord["degree_root"] = degree
        chord["degree"] = _quality_roman(degree, chord)
        bass_degree, _ = _degree(_root_pc(chord["bass"]), tonic_pc, intervals)
        chord["bass_degree"] = bass_degree if chord["bass_pc"] != chord["root_pc"] else None
        chord["diatonic"] = (chord["root_pc"] - tonic_pc) % 12 in intervals
        chord["degree_index"] = index
        chord["diatonic_symbol"] = _diatonic_chord(tonic_pc, intervals, index, flats)

    # -1 means nothing is selected: the palette then appends instead of replacing,
    # but still takes its shape and its context from the last chord.
    if not chords:
        selected_index = -1
    elif selected_index is None:
        selected_index = len(chords) - 1
    elif selected_index < 0:
        selected_index = -1
    else:
        selected_index = min(selected_index, len(chords) - 1)
    reference = chords[selected_index] if selected_index >= 0 else (chords[-1] if chords else None)
    context_degree = reference["degree_index"] if reference else 0
    stable_order = [0, 4, 3] if context_degree in {1, 3, 4, 6} else [4, 0, 3]
    color_order = [1, 5, 2, 6]
    next_chords = []
    for degree in stable_order:
        symbol = _diatonic_chord(tonic_pc, intervals, degree, flats)
        parsed = parse_chord(symbol)
        next_chords.append({"symbol": symbol, "degree": _quality_roman(ROMANS[degree], parsed), "kind": "Опора", "group": "stable", "reason": "функционально ясно", "midi": parsed["midi"] if parsed else []})
    for degree in color_order:
        symbol = _diatonic_chord(tonic_pc, intervals, degree, flats)
        parsed = parse_chord(symbol)
        next_chords.append({"symbol": symbol, "degree": _quality_roman(ROMANS[degree], parsed), "kind": "Лад", "group": "color", "reason": "показывает краску лада", "midi": parsed["midi"] if parsed else []})
    contrast_specs = [(1, "", "bII", "неаполитанская краска"), (2, "7", "V/V", "вторичная доминанта"), (0, "" if _mode_chord_quality(intervals, 0) == "min" else "m", "I↔i", "смена наклонения")]
    for offset, suffix, degree, reason in contrast_specs:
        symbol = _borrowed_symbol(tonic_pc, offset, suffix, flats)
        parsed = parse_chord(symbol)
        next_chords.append({"symbol": symbol, "degree": degree, "kind": "Вне лада", "group": "contrast", "reason": reason, "midi": parsed["midi"] if parsed else []})
    seen = set()
    next_chords = [item for item in next_chords if not (item["symbol"] in seen or seen.add(item["symbol"]))]

    # The palette answers "the same chord, one degree over", so it takes the
    # type and inversion of whatever is selected, and the mode being borrowed.
    selected_chord = chords[selected_index] if selected_index >= 0 else None
    template = {"type": "triad", "inversion": None}
    if reference:
        template = {
            "type": reference["state"]["type"],
            "inversion": reference["state"]["inversion"],
            "options": reference["state"].get("options") or [],
        }
    template["secondary"] = palette_secondary if palette_secondary in SECONDARY_STEPS else None
    palette_key = (palette_mode or mode_key).lower()
    palette_intervals = MODE_INTERVALS.get(palette_key, intervals)
    borrowed = palette_key != mode_key
    diatonic_palette = []
    secondary_label = {"V": "V", "IV": "IV", "vii": "vii°"}.get(template.get("secondary"))
    for degree in range(7):
        state = degree_state(tonic_pc, palette_intervals, degree, flats, template)
        symbol = compose_symbol(state)
        parsed = parse_chord(symbol)
        if secondary_label:
            # A secondary is named after what it points at: vii°/ii, not vii°.
            target = degree_state(tonic_pc, palette_intervals, degree, flats, {**template, "secondary": None})
            target_parsed = parse_chord(compose_symbol(target))
            target_roman = _degree(target_parsed["root_pc"], tonic_pc, intervals)[0] if borrowed and target_parsed else ROMANS[degree]
            label = f"{secondary_label}/{_quality_roman(target_roman, target_parsed) if target_parsed else target_roman}"
        else:
            # A borrowed degree is named against the home key, so #iv reads as #iv.
            roman = _degree(parsed["root_pc"], tonic_pc, intervals)[0] if borrowed and parsed else ROMANS[degree]
            label = _quality_roman(roman, parsed) if parsed else roman
        diatonic_palette.append({
            "symbol": symbol,
            "degree": label,
            "degree_index": degree,
            "borrowed": borrowed,
            "secondary": template.get("secondary"),
            "midi": parsed["midi"] if parsed else [],
        })
    palette_context = {
        "mode": palette_key,
        "label": MODE_NAMES.get(palette_key, palette_key),
        "borrowed": borrowed,
        "type": template["type"],
        "inversion": template["inversion"],
        "options": template.get("options") or [],
        "secondary": template.get("secondary"),
    }

    statistics = catalog_statistics()
    key_chords = _weighted_chords(statistics["overall"], tonic_pc, intervals, flats, 12)
    context_key = None
    if reference:
        context_key = ((reference["root_pc"] - tonic_pc) % 12, _triad_quality(reference))
    context_chords = _weighted_chords(statistics["transitions"].get(context_key), tonic_pc, intervals, flats, 12) if context_key else []

    melody_notes = annotate_melody(normalise_melody(melody), chords, tonic_pc, intervals, flats)
    selected_tones = {midi % 12 for midi in selected_chord["midi"]} if selected_chord else set()
    grid = melody_grid(tonic_pc, intervals, flats, chromatic=chromatic)
    for row in grid:
        row["chord_tone"] = row["pitch_class"] in selected_tones
    try:
        beats_per_bar = max(1, int(str(meter).split("/")[0]))
    except (TypeError, ValueError):
        beats_per_bar = 4
    used_beats = max(
        (chords[-1]["start"] + chords[-1]["beats"]) if chords else 0.0,
        max((note["start"] + note["duration"] for note in melody_notes), default=0.0),
    )
    # Always lay out at least sixteen bars, so there is empty grid to write into
    # rather than a canvas that stops where the material happens to end.
    bars = max(MIN_TIMELINE_BARS, math.ceil(used_beats / beats_per_bar) if used_beats else 0)
    timeline = {
        "beats_per_bar": beats_per_bar,
        "total_beats": round(bars * beats_per_bar, 4),
        "used_beats": round(used_beats, 4),
        "bars": bars,
        "chromatic": bool(chromatic),
    }

    has_melody = bool(melody_notes)
    poly = catalog()["polyphony"]
    preferred = ["contrary_motion", "shadow_voice", "hocket"] if has_melody else ["pedal_voice", "counter_rhythm", "canon"]
    chosen_poly = [next(item for item in poly if item["id"] == pid) for pid in preferred]
    ref = catalog()["references"]
    scale_notes = [(PC_FLAT if flats else PC_SHARP)[(tonic_pc + step) % 12] for step in intervals]
    color_degree = {"dorian": "натуральная VI", "phrygian": "пониженная II", "lydian": "повышенная IV", "mixolydian": "пониженная VII", "minor": "пониженные III, VI и VII", "aeolian": "пониженные III, VI и VII", "locrian": "пониженные II и V"}.get(mode_key, "натуральные IV и VII")
    actions = [
        {"type": "harmony", "title": "Уточнить гармоническую краску", "action": f"Обыграйте {tonic} {MODE_NAMES.get(mode_key, mode_key)}: {', '.join(scale_notes)}. Характерный признак — {color_degree}.", "reference": ref["modes"]},
        {"type": "polyphony", "title": chosen_poly[0]["name"], "action": chosen_poly[0]["action"], "risk": chosen_poly[0]["risk"], "reference": ref["polyphony"]},
        {"type": "arrangement", "title": "Один контролируемый сдвиг", "action": _arrangement_move(chords)["action"], "reference": ref["arrangement"]},
    ]
    catalog_matches = []
    transitions = []
    dial_colors: dict[str, dict] = {}
    try:
        from sidecar import ptm_analysis
        steps = [((item["root_pc"] - tonic_pc) % 12, _triad_quality(item)) for item in chords]
        catalog_matches = ptm_analysis.match_catalog(steps)[:5] if len(steps) >= 2 else []
        ptm_chords = [ptm_analysis.parse_chord(item["symbol"]) for item in chords]
        for left, right in zip(ptm_chords, ptm_chords[1:]):
            if not left or not right:
                continue
            transition = ptm_analysis.analyze_transition(left, right)
            pair = transition.get("pair")
            transitions.append(transition)
            if pair:
                key = str(pair["category"])
                item = dial_colors.setdefault(key, {"category": pair["category"], "name": pair["category_name"], "count": 0, "moods": []})
                item["count"] += 1
                if pair["mood"] not in item["moods"]:
                    item["moods"].append(pair["mood"])
    except Exception:
        # The Lab stays usable when an optional knowledge provider is unavailable.
        catalog_matches = []
    colored_total = sum(item["count"] for item in dial_colors.values()) or 1
    colors = sorted(dial_colors.values(), key=lambda item: item["count"], reverse=True)
    for item in colors:
        item["share"] = round(item["count"] / colored_total, 3)
    hypotheses = _infer_keys(chords, flats)
    declared_mode = "ionian" if mode_key == "major" else "aeolian" if mode_key == "minor" else mode_key
    inferred = hypotheses[0] if hypotheses else None
    return {
        "key": {"tonic": tonic, "mode": mode_key, "label": f"{tonic} {MODE_NAMES.get(mode_key, mode_key)}", "scale_notes": scale_notes, "characteristic": color_degree},
        "tonality_analysis": {"declared": f"{tonic} {MODE_NAMES.get(mode_key, mode_key)}", "inferred": inferred, "alternatives": hypotheses[1:], "matches_declared": bool(inferred and inferred["tonic_pc"] == tonic_pc and inferred["mode"] == declared_mode)},
        "transitions": transitions,
        "dial_colors": colors,
        "chords": chords,
        "selected_index": selected_index,
        "melody": melody_notes,
        "melody_grid": grid,
        "timeline": timeline,
        "diatonic_palette": diatonic_palette,
        "palette_context": palette_context,
        "next_chords": next_chords,
        "key_chords": key_chords,
        "context_chords": context_chords,
        "statistics_source": {"progressions": statistics["entries"], "observations": sum(statistics["overall"].values())},
        "actions": actions,
        "polyphony_options": chosen_poly,
        "catalog_matches": catalog_matches,
        "knowledge": {"providers": [item["id"] for item in catalog()["knowledge_sources"]], "ptm_catalog_size": 189},
        "references": list(ref.values()),
        "warnings": ["Не удалось разобрать часть аккордовой записи."] if chord_input and len(chords) < len([x for x in re.split(r"\s+|\s*[—–→,;|]\s*", chord_input.strip()) if x]) else [],
    }
