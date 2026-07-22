from pathlib import Path
import json
import threading
from urllib.request import Request, urlopen

from sidecar.server import HarmonyCanvasServer, SketchStore, build_advice


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


def test_first_instance_claims_legacy_sketch_and_keeps_it(tmp_path: Path):
    store = SketchStore(tmp_path / "sketches.json")
    store.ensure_seed()
    legacy_id = store.list()[0]["id"]

    claimed = store.get_or_create_for_instance("instance-a")

    assert claimed["id"] == legacy_id
    assert claimed["instance_id"] == "instance-a"
    assert store.get_or_create_for_instance("instance-a")["id"] == legacy_id


def test_plugin_instances_receive_isolated_sketches(tmp_path: Path):
    store = SketchStore(tmp_path / "sketches.json")
    store.ensure_seed()
    first = store.get_or_create_for_instance("instance-a")
    second = store.get_or_create_for_instance("instance-b")

    assert first["id"] != second["id"]
    assert second["chord_input"] == ""
    store.update(first["id"], {"chord_input": "Dm Gm"})
    assert store.get(second["id"])["chord_input"] == ""
    assert [item["id"] for item in store.list("instance-a")] == [first["id"]]
    assert [item["id"] for item in store.list("instance-b")] == [second["id"]]


def test_shutdown_endpoint_stops_sidecar_without_waiting_for_parent(tmp_path: Path):
    store = SketchStore(tmp_path / "sketches.json")
    store.ensure_seed()
    server = HarmonyCanvasServer(("127.0.0.1", 0), store)
    thread = threading.Thread(target=server.serve_forever)
    thread.start()
    try:
        port = server.server_address[1]
        request = Request(f"http://127.0.0.1:{port}/api/shutdown", data=b"", method="POST")
        with urlopen(request, timeout=2) as response:
            payload = json.loads(response.read())
        thread.join(timeout=2)
        assert payload["shutting_down"] is True
        assert not thread.is_alive()
    finally:
        server.server_close()
