"""Harmony reference data behind two Lab features: the Pair Dial's chord-pair
mood (`pair_mood`, `analyze_transition`, via the 46 modal chord pairs) and the
"theory catalog" matches shown under a sketch (`catalog`, `match_catalog`,
rotation-invariant matching against the PTM-26 progression catalogs — 27
simple, 14 classes, 12 cinematic — in `data/ptm/`). `parse_chord` is the
shared entry point both paths normalize a chord label through.
"""

from __future__ import annotations
import json
import re
from functools import lru_cache
from pathlib import Path
from sidecar.songmaster import NOTE_TO_PC, m2tm_chord
DATA_DIR = Path(__file__).parent / "data" / "ptm"

MAJOR_SCALE_SEMIS = [0, 2, 4, 5, 7, 9, 11]

ROMAN_VALUE = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7}

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

def _load(name: str) -> dict:
    with open(DATA_DIR / f"{name}.json", encoding="utf-8") as fh:
        return json.load(fh)

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

PAIRABLE = {"maj": "maj", "min": "min", "sus2": "maj", "sus4": "maj", "power": "maj"}

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

