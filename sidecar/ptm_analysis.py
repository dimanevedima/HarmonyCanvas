"""Harmony analysis engine based on the PTM-26 theory data (app/data/ptm/).

Takes a SongMaster chord timeline and produces a structured report:

- tonic estimation (duration-weighted Krumhansl profiles, SongMaster key as hint)
- per-transition mood via the 46 modal chord pairs (clock time, category, mood)
- loop detection via repeated n-grams over the compressed chord stream
- rotation-invariant matching against the progression catalogs
  (27 simple, 14 classes, 12 cinematic)
- tonal-functional map (T/S/D per chord, cadences, tonal-vs-modal verdict)

The original chord labels (with 7/9/11/sus/slash-bass) are preserved end to
end; reduction to triads happens only inside the matching step, and every
match made on a reduced chord carries an ``approx`` note, because extensions
shade the mood of a pair.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path

from sidecar.songmaster import (
    DEGREE_TO_SEMITONE,
    NOTE_TO_PC,
    PC_TO_FLAT,
    PC_TO_SHARP,
    ROMAN_BY_DIFF,
    m2tm_chord,
)

DATA_DIR = Path(__file__).parent / "data" / "ptm"

CATEGORY_NAMES = {
    1: "Позитив",
    2: "Фантастика и колорит",
    3: "Сказочность",
    4: "Драматизм и печаль",
    5: "Опасность и тьма",
}

# Krumhansl-Schmuckler key profiles (same values music_analysis_v2 uses).
MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

MAJOR_SCALE_SEMIS = [0, 2, 4, 5, 7, 9, 11]

ROMAN_VALUE = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7}

TRIAD_PCS = {
    "maj": (0, 4, 7),
    "min": (0, 3, 7),
    "dim": (0, 3, 6),
    "aug": (0, 4, 8),
    "sus2": (0, 2, 7),
    "sus4": (0, 5, 7),
    "power": (0, 7),
}


# ── Chord parsing ─────────────────────────────────────────────────────────

def _split_quality(rest: str) -> tuple[str, bool] | None:
    """Quality string (already compact, no root) -> (triad family, has extensions)."""
    r = rest.strip().replace("(", "").replace(")", "")
    if r == "":
        return "maj", False
    if r.startswith("maj"):
        return "maj", True  # maj7 / maj9 / ...
    if r.startswith("dim") or r.startswith("°"):
        return "dim", len(r) > 3
    if r.startswith("aug") or r.startswith("+"):
        return "aug", len(r.lstrip("aug+")) > 0
    if r == "5":
        return "power", False
    if r.startswith("sus2"):
        return "sus2", len(r) > 4
    if r.startswith("sus4") or r == "sus":
        return "sus4", len(r) > 4
    if re.match(r"^m7b5|^mb5|^ø", r):
        return "dim", True
    if r.startswith("m"):
        return "min", len(r) > 1
    if re.match(r"^(add)?(2|4|6|7|9|11|13)", r):
        # dominant 7ths, add-chords, 6ths, 9ths… — major triad + color
        if "sus" in r:
            return ("sus2" if "sus2" in r else "sus4"), True
        return "maj", True
    if re.match(r"^[b#](5|9|11|13)", r):
        # a bare major triad carrying only an altered tone, e.g. C(b5), C(#5)
        return "maj", True
    return None


def parse_chord(label: str) -> dict | None:
    """SongMaster label (``Gb:m7``, ``D/5``) or compact token (``Gbm7``, ``D/F#``)
    -> chord dict. Returns None for empty / "N" / unparseable labels."""
    compact = m2tm_chord(label)
    if not compact:
        return None
    bass_pc = None
    body = compact
    if "/" in compact:
        body, bass = compact.split("/", 1)
        bass_pc = NOTE_TO_PC.get(bass)
    match = re.match(r"^([A-G](?:#|b)?)(.*)$", body)
    if not match or match.group(1) not in NOTE_TO_PC:
        return None
    root_name, rest = match.group(1), match.group(2)
    rest = rest.replace("min", "m").replace("mi", "m")
    split = _split_quality(rest)
    if split is None:
        return None
    triad, has_ext = split
    return {
        "original": (label or "").strip(),
        "name": compact,
        "root_pc": NOTE_TO_PC[root_name],
        "root_name": root_name,
        "quality": rest,
        "triad": triad,
        "has_extensions": has_ext,
        "bass_pc": bass_pc,
    }


def chord_pcs(chord: dict) -> list[int]:
    root = chord["root_pc"]
    pcs = [(root + i) % 12 for i in TRIAD_PCS[chord["triad"]]]
    if chord["bass_pc"] is not None and chord["bass_pc"] not in pcs:
        pcs.append(chord["bass_pc"])
    return pcs


def chord_midis_full(chord: dict) -> list[int]:
    """MIDI notes of the TRUE chord (extensions and slash bass included) for
    playback: bass an octave below, chord around C3, the third doubled an
    octave up (it alone separates major from minor)."""
    quality = re.sub(r"sus[24]?", "", chord["quality"])
    semis = set(TRIAD_PCS[chord["triad"]])
    if re.search(r"maj\d", quality):
        semis.add(11)
    elif "dim7" in quality:
        semis.add(9)
    elif re.search(r"\d", quality):
        digits = re.findall(r"11|13|[24679]", quality)
        if "6" in digits:
            semis.add(9)
        if "7" in digits or "11" in digits or "13" in digits or ("9" in digits and "add" not in quality):
            semis.add(10)
        if "9" in digits:
            semis.add(14)
        if "2" in digits:
            semis.add(14)
        if "11" in digits or "4" in digits:
            semis.add(17)
        if "13" in digits:
            semis.add(21)
    root_midi = 48 + chord["root_pc"]
    bass = 36 + (chord["bass_pc"] if chord["bass_pc"] is not None else chord["root_pc"])
    notes = [bass] + sorted(root_midi + s for s in semis)
    if chord["triad"] in ("maj", "min"):
        notes.append(root_midi + TRIAD_PCS[chord["triad"]][1] + 12)
    return notes


# ── Clock geometry (modal dial) ───────────────────────────────────────────

def fifths_pos(pc: int) -> int:
    return (pc * 7) % 12

def clock_anchor(chord: dict) -> int:
    """Dial anchor: major family — own root, minor — relative major (+3)."""
    if chord["triad"] == "min":
        return (chord["root_pc"] + 3) % 12
    return chord["root_pc"]

def pair_minutes(c1: dict, c2: dict) -> int:
    p1, p2 = fifths_pos(clock_anchor(c1)), fifths_pos(clock_anchor(c2))
    return ((p2 - p1) % 12) * 5

def fmt_clock(minutes: int) -> str:
    return f"12:{minutes:02d}"


# ── PTM data ──────────────────────────────────────────────────────────────

@lru_cache(maxsize=None)
def _load(name: str) -> dict:
    with open(DATA_DIR / f"{name}.json", encoding="utf-8") as fh:
        return json.load(fh)


@lru_cache(maxsize=1)
def pair_table() -> dict[tuple[str, str, int], dict]:
    """(q1, q2, root_diff_semitones) -> pair entry. Table is written from C/Cm."""
    table: dict[tuple[str, str, int], dict] = {}
    for pair in _load("modalChordPairs")["pairs"]:
        c1 = parse_chord(pair["chord_1"])
        c2 = parse_chord(pair["chord_2"])
        if not c1 or not c2:
            continue
        diff = (c2["root_pc"] - c1["root_pc"]) % 12
        table[(c1["triad"], c2["triad"], diff)] = pair
    return table


def parse_roman_token(token: str) -> tuple[int, str] | None:
    """Roman token (``bVII``, ``ii7``, ``I sus4``, ``#I dim``, ``V+``)
    -> (semitones from tonic, triad family)."""
    t = token.strip().replace(" ", "")
    match = re.match(r"^(b|#)?([IViv]+)(.*)$", t)
    if not match:
        return None
    accidental, numeral, suffix = match.groups()
    value = ROMAN_VALUE.get(numeral.upper())
    if value is None:
        return None
    semis = MAJOR_SCALE_SEMIS[value - 1]
    if accidental == "b":
        semis -= 1
    elif accidental == "#":
        semis += 1
    is_lower = numeral == numeral.lower()
    suffix = suffix.strip().lower()
    if suffix.startswith("dim") or suffix == "°":
        triad = "dim"
    elif suffix.startswith("aug") or suffix.startswith("+"):
        triad = "aug"
    elif suffix.startswith("sus2"):
        triad = "sus2"
    elif suffix.startswith("sus"):
        triad = "sus4"
    elif suffix.startswith("m") and not suffix.startswith("maj"):
        triad = "min"
    else:
        triad = "min" if is_lower else "maj"
    return (semis % 12, triad)


def parse_roman_pattern(roman: str) -> list[tuple[int, str]] | None:
    """Catalog pattern string -> list of (semitones, triad); None if unparseable."""
    flat = roman.replace("||", "|").replace("|", "-").replace("///", "")
    tokens: list[str] = []
    for raw in flat.split("-"):
        raw = raw.strip()
        if raw:
            tokens.append(raw)
    if len(tokens) < 2:
        return None
    steps = []
    for token in tokens:
        parsed = parse_roman_token(token)
        if parsed is None:
            return None
        steps.append(parsed)
    return steps


@lru_cache(maxsize=1)
def catalog() -> list[dict]:
    """All catalog progressions with parsed step lists."""
    entries: list[dict] = []
    for prog in _load("progressions")["progressions"]:
        steps = parse_roman_pattern(prog["roman"])
        if steps:
            entries.append({
                "source": "simple",
                "id": prog["id"],
                "roman": prog["roman"],
                "name": f"№{prog['id']:02d} {prog['roman']}",
                "group": prog.get("group", ""),
                "mood": prog.get("mood_or_use", ""),
                "cyclic": True,
                "steps": tuple(steps),
            })
    for cls in _load("progressionClasses")["progression_classes"]:
        for pattern in cls["patterns"]:
            steps = parse_roman_pattern(pattern["roman"])
            if steps:
                entries.append({
                    "source": "classes",
                    "id": cls["class_id"],
                    "roman": pattern["roman"],
                    "name": f"Класс {cls['class_id']}: {cls['name']}",
                    "group": pattern.get("label", ""),
                    "mood": cls.get("note", ""),
                    "cyclic": True,
                    "steps": tuple(steps),
                })
    for pattern in _load("cinematicProgressions")["patterns"]:
        steps = parse_roman_pattern(pattern["roman"])
        if steps:
            entries.append({
                "source": "cine",
                "id": pattern["id"],
                "roman": pattern["roman"],
                "name": pattern.get("name", ""),
                "group": pattern.get("category", ""),
                "mood": pattern.get("use", ""),
                "cyclic": True,
                "steps": tuple(steps),
            })
    for prog in _load("extendedCatalog")["progressions"]:
        steps = parse_roman_pattern(prog["roman"])
        if steps:
            entries.append({
                "source": "extended",
                "id": prog["id"],
                "roman": prog["roman"],
                "name": prog["name_ru"],
                "group": prog.get("name_en", ""),
                "mood": prog.get("mood", ""),
                "cyclic": prog.get("cyclic", True),
                "steps": tuple(steps),
            })
    return entries


@lru_cache(maxsize=1)
def transition_moves() -> list[dict]:
    return _load("extendedCatalog")["transition_moves"]


def _extended_move(c1: dict, c2: dict) -> dict | None:
    """Именованный ход из доп. каталога для перехода вне таблицы 46 пар."""
    diff = (c2["root_pc"] - c1["root_pc"]) % 12
    for move in transition_moves():
        match = move["match"]
        if match.get("any_aug"):
            if "aug" not in (c1["triad"], c2["triad"]):
                continue
        else:
            if "triad_1" in match and c1["triad"] != match["triad_1"]:
                continue
            if "triad_2" in match and c2["triad"] != match["triad_2"]:
                continue
            if "diff" in match and diff != match["diff"]:
                continue
            if "diff_any" in match and diff not in match["diff_any"]:
                continue
        return {"name": move["name_ru"], "mood": move["mood"], "source": "extended"}
    return None


@lru_cache(maxsize=1)
def tfg_tables() -> dict[str, dict[tuple[int, str], str]]:
    """mode -> {(semitones from tonic, triad) -> function string (T/S/D/...)}."""
    data = _load("tfgAlgorithm")
    triad_map = {"maj": "maj", "min": "min", "dim": "dim", "aug": "aug"}
    out: dict[str, dict[tuple[int, str], str]] = {}
    for mode, key in (("major", "major_functions"), ("minor", "minor_functions")):
        table: dict[tuple[int, str], str] = {}
        for degree in data[key]["degrees"]:
            semis = DEGREE_TO_SEMITONE.get(degree["degree"].strip())
            triad = triad_map.get(degree["triad"].strip().lower())
            if semis is None or triad is None:
                continue
            table[(semis % 12, triad)] = degree["function"]
        out[mode] = table
    return out


# ── Tonic estimation ──────────────────────────────────────────────────────

def _correlate(chroma: list[float], profile: list[float]) -> float:
    dot = sum(a * b for a, b in zip(chroma, profile))
    na = sum(a * a for a in chroma) ** 0.5
    nb = sum(b * b for b in profile) ** 0.5
    return dot / (na * nb) if na and nb else 0.0


def estimate_tonic(chords: list[dict], durations: list[float]) -> dict:
    chroma = [0.0] * 12
    for chord, dur in zip(chords, durations):
        for pc in chord_pcs(chord):
            chroma[pc] += dur
    # anchor bonus: the first and last chords often sit on the tonic
    if chords:
        for chord, bonus in ((chords[0], 0.5), (chords[-1], 0.5)):
            total = sum(durations) or 1.0
            chroma[chord["root_pc"]] += bonus * total / max(len(chords), 1)
    scores = []
    for pc in range(12):
        maj = _correlate(chroma, MAJOR_PROFILE[-pc:] + MAJOR_PROFILE[:-pc])
        mnr = _correlate(chroma, MINOR_PROFILE[-pc:] + MINOR_PROFILE[:-pc])
        scores.append((maj, pc, "major"))
        scores.append((mnr, pc, "minor"))
    scores.sort(reverse=True)
    best, runner = scores[0], scores[1]
    return {
        "pc": best[1],
        "name": PC_TO_SHARP[best[1]],
        "mode": best[2],
        "confidence": round(max(0.0, min(1.0, best[0] - runner[0] + 0.35)), 3),
    }


# ── Roman numerals & functions ────────────────────────────────────────────

QUALITY_ROMAN_SUFFIX = {"dim": "dim", "aug": "+", "sus2": "sus2", "sus4": "sus4", "power": "5"}

def roman_of(chord: dict, tonic_pc: int) -> str:
    diff = (chord["root_pc"] - tonic_pc) % 12
    base = ROMAN_BY_DIFF[diff]
    if chord["triad"] in ("min", "dim"):
        base = base.lower()
    suffix = QUALITY_ROMAN_SUFFIX.get(chord["triad"], "")
    if chord["has_extensions"]:
        ext = re.sub(r"^m(?!aj)", "", chord["quality"])
        suffix = suffix or ext
    return base + suffix


def function_of(chord: dict, tonic_pc: int, mode: str) -> str | None:
    table = tfg_tables().get(mode, {})
    diff = (chord["root_pc"] - tonic_pc) % 12
    # dominant 7ths and other colors keep their triad's function
    return table.get((diff, chord["triad"]))


# ── Transitions (46 pairs) ────────────────────────────────────────────────

PAIRABLE = {"maj": "maj", "min": "min", "sus2": "maj", "sus4": "maj", "power": "maj"}


# ── Mood model (docs/MOOD_MODEL_SPEC.md) ──────────────────────────────────
# Affect vectors are (valence, tension, color): dark↔bright, stable↔tense,
# plain↔exotic. The authored 46-pair table stays ground truth for maj/min pairs;
# vectors extend the model to dim/aug, same-root colour moves and extensions.

_TRIAD_VEC = {
    "maj": (2, -1, 0), "min": (-2, -1, 0), "dim": (-1, 2, 0), "aug": (0, 2, 2),
    "sus2": (0, 0, 1), "sus4": (0, 1, 0), "power": (0, 0, 0),
}
_CATEGORY_CENTROID = {1: (2, -1, 0), 2: (0, 1, 2), 3: (1, 0, 2), 4: (-2, 1, 0), 5: (-2, 2, 1)}
_CATEGORY_NAME = {1: "Позитив", 2: "Фантастика и колорит", 3: "Сказочность", 4: "Драматизм и печаль", 5: "Опасность и тьма"}
_CATEGORY_PHRASE = {1: "Светло, позитивно", 2: "Колоритно, фантастично", 3: "Волшебно, сказочно", 4: "Драматично, печально", 5: "Тревожно, темно"}


def _color_modifiers(chord: dict) -> tuple[int, int, int, list[str]]:
    """Extension colour of a chord as (Δvalence, Δtension, Δcolor, note-words),
    on top of its triad. Values from docs/MOOD_MODEL_SPEC.md §3.2."""
    q = chord["quality"].lower()
    triad = chord["triad"]
    v = t = c = 0
    notes: list[str] = []

    def add(dv: int, dt: int, dc: int, word: str = "") -> None:
        nonlocal v, t, c
        v += dv; t += dt; c += dc
        if word:
            notes.append(word)

    if re.search(r"maj\d", q):
        add(1, 0, 1, "утончённо (maj7)")
    elif triad == "maj" and "add" not in q and re.search(r"(?<![a-z])(7|9|11|13)", q):
        add(0, 1, 0, "доминантовая тяга")
    if "dim7" in q or re.search(r"°7|o7", q):
        add(-1, 2, 2, "портал (dim7)")
    elif triad == "dim" and "7" in q:
        add(-1, 1, 1, "полууменьшённо")
    if re.search(r"(?<![0-9])6", q) or "add6" in q:
        add(1, 0, 1, "тепло, джаз (6)")
    # Highest NATURAL upper tension carries its own PTM character
    # (step_characteristics §3.2) — 9/11/13 are no longer a flat "красочно".
    if re.search(r"(?<![b#])13", q):
        add(1, 0, 1, "тепло, ностальгия (13)")
    elif re.search(r"(?<![b#])11", q):
        add(0, 1, 1, "открыто, подвешенно (11)")
    elif re.search(r"(?<![b#])9", q):
        add(0, 0, 1, "воздушно, мечтательно (9)")
    # Altered tensions — each its own colour
    if "#11" in q:
        add(1, 1, 2, "лидийский блеск (#11)")
    for alt, dv, dt, dc, word in (
        ("b9", -1, 2, 1, "напряжённо (b9)"),
        ("#9", -1, 2, 1, "остро, блюзово (#9)"),
        ("b11", -1, 2, 1, "диссонанс (b11)"),
        ("b13", -1, 1, 1, "тёмная краска (b13)"),
        ("#5", 0, 1, 2, "парящее (#5)"),
        ("b5", -1, 1, 1, "неустойчиво (b5)"),
    ):
        if alt in q:
            add(dv, dt, dc, word)
    return v, t, c, notes


def chord_color(chord: dict) -> tuple[int, int, int]:
    base = _TRIAD_VEC.get(chord["triad"], (0, 0, 0))
    dv, dt, dc, _ = _color_modifiers(chord)
    clamp = lambda x: max(-4, min(4, x))
    return (clamp(base[0] + dv), clamp(base[1] + dt), clamp(base[2] + dc))


def _nearest_category(pos: tuple[float, float, float]) -> int:
    return min(_CATEGORY_CENTROID, key=lambda k: sum((a - b) ** 2 for a, b in zip(pos, _CATEGORY_CENTROID[k])))


def _compose_mood(category: int, notes: list[str]) -> str:
    base = _CATEGORY_PHRASE[category]
    return f"{base} · {', '.join(notes)}" if notes else base


_MOVE_ARCHETYPES = [
    # (predicate on (dv,dt,dc) delta, category-bias, phrase)
]


def _color_move_mood(c1: dict, c2: dict, clock: str) -> dict:
    """Same-root colour move (interval 0): mood from the delta of colour vectors
    plus a named archetype (docs §5.1)."""
    a = chord_color(c1)
    b = chord_color(c2)
    dt = b[1] - a[1]
    _, _, _, notes = _color_modifiers(c2)
    n1 = len(_color_modifiers(c1)[3])
    q2 = c2["quality"].lower()
    tri2 = c2["triad"]
    if (len(notes) < n1 and dt <= 0) or dt <= -2:            # снятие сложности/тяги
        arch, cat = "разрешение, снятие напряжения", 1
    elif tri2 == "aug" or "#5" in q2:
        arch, cat = "парение, экзотика", 2
    elif tri2 == "dim":
        arch, cat = "затемнение, тревога", 5 if dt >= 2 else 4
    elif tri2 == "min":
        arch, cat = "затемнение, драматизация", 4
    elif tri2 in ("sus2", "sus4") or "add" in q2 or "11" in q2:
        arch, cat = "раскрытие, воздушно", 3
    elif "b5" in q2 or "b9" in q2 or "#9" in q2 or "b13" in q2 or dt >= 2:
        arch, cat = "уплотнение, напряжение", 4
    elif b[2] - a[2] >= 1:
        arch, cat = "потепление, красочно", 3
    else:
        arch, cat = "смена окраски", _nearest_category(b)
    return {
        "category": cat, "category_name": _CATEGORY_NAME[cat], "clock": clock,
        "mood": f"{_CATEGORY_PHRASE[cat]} · {arch}" + (f" · {', '.join(notes)}" if notes else ""),
        "provenance": "derived", "kind": "same_root",
    }


def pair_mood(c1: dict, c2: dict) -> dict:
    """Enriched mood for any ordered chord pair. Authored where the triad
    skeleton is in the 46-pair table, otherwise derived from the vector model."""
    anchor1 = PAIRABLE.get(c1["triad"], c1["triad"])
    anchor2 = PAIRABLE.get(c2["triad"], c2["triad"])
    eff1 = {**c1, "triad": anchor1}
    eff2 = {**c2, "triad": anchor2}
    clock = fmt_clock(pair_minutes(eff1, eff2))
    interval = (c2["root_pc"] - c1["root_pc"]) % 12

    # Same root, same triad family: a pure colour move (C -> C11). A same-root
    # maj<->min flip (C -> Cm) is an authored pair, so it falls through below.
    if c1["root_pc"] == c2["root_pc"] and anchor1 == anchor2:
        return _color_move_mood(c1, c2, clock)

    if anchor1 in ("maj", "min") and anchor2 in ("maj", "min"):
        entry = pair_table().get((anchor1, anchor2, interval))
        if entry:
            base = entry["category"]
            e1v, e1t, e1c, n1 = _color_modifiers(c1)
            e2v, e2t, e2c, n2 = _color_modifiers(c2)
            centroid = _CATEGORY_CENTROID[base]
            pos = (centroid[0] + e1v + e2v, centroid[1] + e1t + e2t, centroid[2] + e1c + e2c)
            flipped = _nearest_category(pos)
            notes = n1 + n2
            # Conservative: keep the authored category unless the colour clearly
            # pulls the pair into another one (margin, docs §5 / §11.2).
            base_dist = sum((a - b) ** 2 for a, b in zip(pos, centroid))
            flip_dist = sum((a - b) ** 2 for a, b in zip(pos, _CATEGORY_CENTROID[flipped]))
            if flipped != base and flip_dist + 3 < base_dist:
                return {"category": flipped, "category_name": _CATEGORY_NAME[flipped], "clock": clock,
                        "mood": _compose_mood(flipped, notes), "provenance": "derived", "kind": "modal"}
            mood = entry["mood_description"] + (f" · {', '.join(notes)}" if notes else "")
            return {"category": base, "category_name": entry["category_name"], "clock": clock,
                    "mood": mood, "provenance": "authored", "kind": "modal", "number": entry["number"]}

    # Vector fallback: dim/aug involved or no authored entry. The destination
    # chord dominates the resulting colour; the interval adds friction.
    a = chord_color(c1)
    b = chord_color(c2)
    friction = 2 if interval in (1, 2, 6, 10, 11) else 0
    pos = (b[0] + a[0] * 0.4, b[1] + a[1] * 0.4 + friction, b[2] + a[2] * 0.4)
    cat = _nearest_category(pos)
    _, _, _, notes = _color_modifiers(c2)
    for chord in (c1, c2):
        if chord["triad"] == "dim":
            notes.append("неустойчиво (dim)")
        elif chord["triad"] == "aug":
            notes.append("парящее (aug)")
    return {"category": cat, "category_name": _CATEGORY_NAME[cat], "clock": clock,
            "mood": _compose_mood(cat, notes), "provenance": "heuristic", "kind": "modal"}


def analyze_transition(c1: dict, c2: dict) -> dict:
    approx: list[str] = []
    q1, q2 = PAIRABLE.get(c1["triad"]), PAIRABLE.get(c2["triad"])
    entry = None
    if q1 and q2:
        for chord, q in ((c1, q1), (c2, q2)):
            if chord["triad"] in ("sus2", "sus4", "power"):
                approx.append(f"{chord['name']}: {chord['triad']} сведён к мажорному якорю")
            elif chord["has_extensions"]:
                approx.append(f"{chord['name']}: надстройки могут менять оттенок")
        diff = (c2["root_pc"] - c1["root_pc"]) % 12
        entry = pair_table().get((q1, q2, diff))
    else:
        for chord in (c1, c2):
            if chord["triad"] in ("dim", "aug"):
                approx.append(f"{chord['name']}: {chord['triad']} вне таблицы 46 пар")
    eff1 = {**c1, "triad": q1 or c1["triad"]}
    eff2 = {**c2, "triad": q2 or c2["triad"]}
    minutes = pair_minutes(eff1, eff2)
    same_root = c1["root_pc"] == c2["root_pc"] and c1["triad"] == c2["triad"]
    if same_root:
        approx = ["смена окраски того же аккорда (не модальная пара)"]
        entry = None
    result = {
        "from": c1["name"],
        "to": c2["name"],
        "minutes": minutes,
        "clock": fmt_clock(minutes),
        "same_root": same_root,
        "pair": None,
        "mood": pair_mood(c1, c2),  # always present: authored / derived / heuristic
        "move": None if (entry or same_root) else _extended_move(c1, c2),
        "approx": approx,
    }
    if entry:
        result["pair"] = {
            "number": entry["number"],
            "interval": entry["interval"],
            "clock": entry["clock"],
            "category": entry["category"],
            "category_name": entry["category_name"],
            "mood": entry["mood_description"],
            "highlighted": bool(entry.get("flags", {}).get("highlighted")),
        }
    return result


# ── Loops & catalog matching ──────────────────────────────────────────────

def _canonical_rotation(seq: tuple) -> tuple:
    rotations = [seq[i:] + seq[:i] for i in range(len(seq))]
    return min(rotations)


def _fundamental_period(seq: tuple) -> int:
    n = len(seq)
    for p in range(1, n):
        if n % p == 0 and seq == seq[:p] * (n // p):
            return p
    return n


def detect_loops(ids: tuple, limit: int = 8) -> list[dict]:
    """Repeated n-grams (2..8) over the compressed chord id stream,
    deduplicated by cyclic rotation; longer and more frequent first.
    Windows that are themselves repeats of a shorter cycle (I-Isus4-I-Isus4)
    are skipped — only the fundamental cycle counts."""
    counter: Counter[tuple] = Counter()
    first_seen: dict[tuple, tuple] = {}
    for size in range(2, min(8, len(ids) - 1) + 1):
        for i in range(len(ids) - size + 1):
            window = ids[i:i + size]
            if len(set(window)) < 2:
                continue
            canon = _canonical_rotation(window)
            if _fundamental_period(canon) < len(canon):
                continue
            counter[canon] += 1
            first_seen.setdefault(canon, window)
    loops = []
    taken: list[tuple] = []
    for canon, count in sorted(counter.items(), key=lambda kv: (kv[1] * len(kv[0]), len(kv[0])), reverse=True):
        if count < 2:
            continue
        # drop patterns fully contained in an already accepted longer loop
        if any(set(canon) <= set(t) and len(canon) < len(t) for t in taken):
            continue
        loops.append({"ids": first_seen[canon], "count": count})
        taken.append(canon)
        if len(loops) >= limit:
            break
    return loops


def _loop_family_alignment(loop_a: dict, loop_b: dict) -> dict | None:
    """Return a musically conservative cyclic alignment for two loops.

    A family is defined by ordered root motion, not by the unordered set of
    roots.  The shorter cycle may tile an expansion of up to two cycles; root
    substitutions are limited to 25%, while chord-quality changes are scored
    separately.  Trying every phase makes true rotations equivalent without
    making arbitrary permutations equivalent.
    """
    ids_a = tuple(loop_a.get("ids", ()))
    ids_b = tuple(loop_b.get("ids", ()))
    if not ids_a or not ids_b:
        return None
    short, long = (ids_a, ids_b) if len(ids_a) <= len(ids_b) else (ids_b, ids_a)
    if len(long) / len(short) > 2.25:
        return None

    best = None
    for phase in range(len(short)):
        root_changes = 0
        quality_changes = 0
        for i, (root, triad) in enumerate(long):
            expected_root, expected_triad = short[(i + phase) % len(short)]
            if root != expected_root:
                root_changes += 1
            elif triad != expected_triad:
                quality_changes += 1
        score = (root_changes + quality_changes * 0.35) / len(long)
        candidate = {
            "score": round(score, 3),
            "phase": phase,
            "root_changes": root_changes,
            "quality_changes": quality_changes,
            "expanded": len(ids_a) != len(ids_b),
        }
        if best is None or candidate["score"] < best["score"]:
            best = candidate

    max_root_changes = max(0, len(long) // 4)
    max_quality_changes = max(1, len(long) // 3)
    if best["root_changes"] > max_root_changes or best["quality_changes"] > max_quality_changes:
        return None
    return best


def _family_relation(alignment: dict) -> str:
    parts = []
    if alignment["expanded"]:
        parts.append("расширение цикла")
    elif alignment["phase"]:
        parts.append("ротация")
    if alignment["root_changes"]:
        parts.append(f"замена корня · {alignment['root_changes']}")
    if alignment["quality_changes"]:
        parts.append(f"смена качества · {alignment['quality_changes']}")
    return ", ".join(parts) or "точный вариант"


def group_loop_families(loop_entries: list[dict]) -> list[dict]:
    """Merge cyclically aligned variants while preserving harmonic order."""
    families: list[dict] = []
    for loop in sorted(loop_entries, key=lambda l: l["count"] * len(l["chords"]), reverse=True):
        for family in families:
            alignment = _loop_family_alignment(family["main"], loop)
            if alignment is not None:
                family["variants"].append((loop, alignment))
                break
        else:
            families.append({"main": loop, "variants": []})
    out = []
    for family in families:
        entry = dict(family["main"])
        entry.pop("root_pcs", None)
        entry.pop("ids", None)
        entry["variants"] = [
            {
                "chords": variant["chords"],
                "roman": variant["roman"],
                "count": variant["count"],
                "start": variant["start"],
                "relation": _family_relation(alignment),
                "distance": alignment["score"],
            }
            for variant, alignment in sorted(
                family["variants"], key=lambda item: (item[1]["score"], -item[0]["count"])
            )[:4]
        ]
        out.append(entry)
    return out[:5]


def match_catalog(song_steps: list[tuple[int, str]]) -> list[dict]:
    """Count occurrences of every catalog progression (all rotations) as a
    contiguous subsequence of the song's (degree, triad) stream."""
    matches = []
    n = len(song_steps)
    for entry in catalog():
        steps = entry["steps"]
        size = len(steps)
        if size > n:
            continue
        rotations = (
            {steps[i:] + steps[:i] for i in range(size)}
            if entry.get("cyclic", True) else {steps}
        )
        count = 0
        positions = []
        for i in range(n - size + 1):
            window = tuple(song_steps[i:i + size])
            if window in rotations:
                count += 1
                positions.append(i)
        if count:
            matches.append({
                "source": entry["source"],
                "id": entry["id"],
                "roman": entry["roman"],
                "name": entry["name"],
                "group": entry["group"],
                "mood": entry["mood"],
                "length": size,
                "count": count,
                "positions": positions,
                "cyclic": entry.get("cyclic", True),
            })
    matches.sort(key=lambda m: (m["count"] * m["length"], m["length"]), reverse=True)
    return matches


# ── Cadences ──────────────────────────────────────────────────────────────

CADENCES = [
    ((7, 0), "Автентическая (V→I)"),
    ((5, 0), "Плагальная (IV→I)"),
    ((7, 9), "Прерванная (V→vi)"),
]

def cadence_of(c1: dict, c2: dict, tonic_pc: int) -> str | None:
    d1 = (c1["root_pc"] - tonic_pc) % 12
    d2 = (c2["root_pc"] - tonic_pc) % 12
    for (a, b), name in CADENCES:
        if d1 == a and d2 == b:
            return name
    if d2 == 7:
        return "Половинная (…→V)"
    return None


# ── Main entry points ─────────────────────────────────────────────────────

def _compress(parsed: list[tuple[dict, float]]) -> list[tuple[dict, float]]:
    out: list[tuple[dict, float]] = []
    for chord, dur in parsed:
        if out and out[-1][0]["name"] == chord["name"]:
            out[-1] = (out[-1][0], out[-1][1] + dur)
        else:
            out.append((chord, dur))
    return out


def _section_label(sections: list[dict] | None, chord: dict) -> str | None:
    if not sections or chord.get("start_sec") is None:
        return None
    mid = (float(chord["start_sec"]) + float(chord.get("end_sec") or chord["start_sec"])) / 2
    for section in sections:
        if float(section["start_sec"]) <= mid < float(section["end_sec"]):
            return section.get("label") or None
    return None


def analyze(
    chords: list[dict],
    key_hint: str = "",
    sections: list[dict] | None = None,
    bpm: float | None = None,
) -> dict:
    """chords: SongMaster style [{start_sec, end_sec, chord}] (timings optional)."""
    parsed: list[tuple[dict, float]] = []
    for item in chords:
        chord = parse_chord(item.get("chord", ""))
        if chord is None:
            continue
        dur = max(0.0, float(item.get("end_sec", 0)) - float(item.get("start_sec", 0))) or 1.0
        chord = {**chord, "start_sec": item.get("start_sec"), "end_sec": item.get("end_sec")}
        parsed.append((chord, dur))
    parsed = _compress(parsed)
    if len(parsed) < 2:
        return {"error": "Недостаточно аккордов для анализа", "chord_count": len(parsed)}

    seq = [c for c, _ in parsed]
    durs = [d for _, d in parsed]

    # песня во флэтах — называем ноты флэтами (Bb, а не A#)
    flats = sum(1 for c in seq if "b" in c["root_name"])
    sharps = sum(1 for c in seq if "#" in c["root_name"])
    pc_names = PC_TO_FLAT if flats > sharps else PC_TO_SHARP

    tonic = estimate_tonic(seq, durs)
    tonic["name"] = pc_names[tonic["pc"]]
    hint = parse_chord(key_hint) if key_hint else None
    tonic["hint"] = key_hint or None
    tonic["agrees_with_hint"] = bool(hint) and hint["root_pc"] == tonic["pc"]

    tonic_pc, mode = tonic["pc"], tonic["mode"]

    chords_out = []
    for chord, dur in parsed:
        chords_out.append({
            "original": chord["original"],
            "name": chord["name"],
            "root": chord["root_name"],
            "triad": chord["triad"],
            "has_extensions": chord["has_extensions"],
            "bass": pc_names[chord["bass_pc"]] if chord["bass_pc"] is not None else None,
            "roman": roman_of(chord, tonic_pc),
            "function": function_of(chord, tonic_pc, mode),
            "midis": chord_midis_full(chord),
            "duration_sec": round(dur, 2),
            "start_sec": chord["start_sec"],
            "end_sec": chord["end_sec"],
            "section": _section_label(sections, chord),
        })

    transitions = [analyze_transition(seq[i], seq[i + 1]) for i in range(len(seq) - 1)]

    mood_counts: Counter[int] = Counter()
    for tr in transitions:
        if tr["pair"]:
            mood_counts[tr["pair"]["category"]] += 1
    total_tr = len(transitions) or 1
    mood_summary = [
        {
            "category": cat,
            "category_name": CATEGORY_NAMES[cat],
            "count": count,
            "share": round(count / total_tr, 3),
        }
        for cat, count in mood_counts.most_common()
    ]

    ids = tuple((c["root_pc"], c["triad"]) for c in seq)
    loop_entries = []
    for loop in detect_loops(ids):
        size = len(loop["ids"])
        start = next(
            i for i in range(len(ids) - size + 1)
            if ids[i:i + size] == loop["ids"]
        )
        members = seq[start:start + size]
        steps = [((c["root_pc"] - tonic_pc) % 12, c["triad"]) for c in members]
        loop_entries.append({
            "chords": [c["name"] for c in members],
            "roman": " - ".join(roman_of(c, tonic_pc) for c in members),
            "root_pcs": [c["root_pc"] for c in members],
            "ids": [(c["root_pc"], c["triad"]) for c in members],
            "start": start,
            "count": loop["count"],
            "matches": match_catalog(steps)[:3],
        })
    loop_entries = group_loop_families(loop_entries)

    song_steps = [((c["root_pc"] - tonic_pc) % 12, c["triad"]) for c in seq]
    catalog_matches = match_catalog(song_steps)[:12]

    functions = [c["function"] for c in chords_out]
    diatonic = sum(1 for f in functions if f)
    share = diatonic / len(functions)
    verdict = (
        "тонально-функциональная" if share >= 0.85
        else "смешанная" if share >= 0.5
        else "модальная"
    )
    cadence = cadence_of(seq[-2], seq[-1], tonic_pc) if len(seq) >= 2 else None

    unrecognized = {
        "transitions": [
            {"from": tr["from"], "to": tr["to"], "clock": tr["clock"], "approx": tr["approx"]}
            for tr in transitions
            if tr["pair"] is None and tr["move"] is None and not tr["same_root"]
        ],
        "loops": [loop for loop in loop_entries if not loop["matches"]],
    }

    return {
        "tonic": tonic,
        "bpm": round(float(bpm), 1) if bpm else None,
        "chord_count": len(seq),
        "chords": chords_out,
        "transitions": transitions,
        "mood_summary": mood_summary,
        "loops": loop_entries,
        "catalog_matches": catalog_matches,
        "tfg": {
            "diatonic_share": round(share, 3),
            "verdict": verdict,
            "final_cadence": cadence,
        },
        "unrecognized": unrecognized,
    }


def analyze_tokens(tokens: list[str], key_hint: str = "") -> dict:
    """Convenience wrapper for plain chord token lists (tests, debugging)."""
    return analyze([{"chord": t, "start_sec": 0, "end_sec": 0} for t in tokens], key_hint)
