from pathlib import Path

from sidecar.server import SketchStore, build_advice


def test_store_seeds_and_round_trips_without_referencecompare(tmp_path: Path):
    store = SketchStore(tmp_path / "sketches.json")
    store.ensure_seed()
    seeded = store.list()
    assert len(seeded) == 1
    assert seeded[0]["chord_input"] == "Bb/D Am/E C Dm13/A"

    changed = store.update(seeded[0]["id"], {"title": "Standalone", "bpm": 131})
    assert changed["title"] == "Standalone"
    assert changed["bpm"] == 131
    assert SketchStore(store.path).get(changed["id"])["title"] == "Standalone"


def test_standalone_advice_contains_timeline_chords_and_notes(tmp_path: Path):
    store = SketchStore(tmp_path / "sketches.json")
    store.ensure_seed()
    advice = build_advice(store.list()[0], {"selected_index": ["0"]})
    assert [item["symbol"] for item in advice["chords"]] == ["Bb/D", "Am/E", "C", "Dm13/A"]
    assert advice["timeline"]["beats_per_bar"] == 4
    assert len(advice["melody"]) == 4
