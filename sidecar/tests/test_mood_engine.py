# -*- coding: utf-8 -*-
"""Acceptance tests for the mood model (docs/MOOD_MODEL_SPEC.md §8)."""
import json
from pathlib import Path

from sidecar.ptm_analysis import parse_chord, pair_mood

DATA = Path(__file__).resolve().parents[1] / "data" / "ptm" / "modalChordPairs.json"


def _pairs():
    return json.load(open(DATA, encoding="utf-8"))["pairs"]


def test_reproduces_all_46_authored_pairs():
    """Model without extensions must return each authored pair's category 1:1."""
    misses = []
    for entry in _pairs():
        c1, c2 = parse_chord(entry["chord_1"]), parse_chord(entry["chord_2"])
        mood = pair_mood(c1, c2)
        if mood["category"] != entry["category"] or mood["provenance"] != "authored":
            misses.append((entry["chord_1"], entry["chord_2"], entry["category"], mood["category"], mood["provenance"]))
    assert not misses, f"authored pairs not reproduced: {misses}"


def _cat(a, b):
    return pair_mood(parse_chord(a), parse_chord(b))


def test_same_root_colour_moves():
    assert _cat("C7", "C")["category"] == 1          # разрешение
    assert _cat("C", "Cdim")["category"] in (4, 5)   # затемнение
    assert _cat("C", "Caug")["category"] == 2        # парение
    for a, b in [("C7", "C"), ("C", "C11"), ("C9", "Csus2"), ("C13", "C(b5)"), ("C", "C6")]:
        m = _cat(a, b)
        assert m["kind"] == "same_root" and m["provenance"] == "derived"


def test_extensions_stay_conservative():
    # A maj->maj +2 pair is Позитив (cat 1); adding maj7/add9 must not flip it.
    assert _cat("Cmaj7", "Dadd9")["category"] == 1
    assert "утончённо (maj7)" in _cat("Cmaj7", "D")["mood"]


def test_dim_aug_get_a_category():
    for a, b in [("Cdim", "G"), ("C", "Edim"), ("Caug", "F"), ("Bdim", "C")]:
        m = _cat(a, b)
        assert m["category"] in (1, 2, 3, 4, 5)
        assert m["provenance"] in ("heuristic", "derived", "authored")


if __name__ == "__main__":
    test_reproduces_all_46_authored_pairs()
    test_same_root_colour_moves()
    test_extensions_stay_conservative()
    test_dim_aug_get_a_category()
    print("all mood-engine tests passed")
