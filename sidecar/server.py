from __future__ import annotations

import argparse
import ctypes
import json
import mimetypes
import os
import sys
import threading
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from sidecar.harmony_engine import (
    analyze_sketch,
    apply_chord_edit,
    apply_note_edit,
    normalise_melody,
)


PROJECT_ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
WEB_ROOT = PROJECT_ROOT / "web"


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_data_file() -> Path:
    override = os.environ.get("HARMONY_CANVAS_DATA")
    if override:
        return Path(override).expanduser().resolve()
    local = Path(os.environ.get("LOCALAPPDATA", Path.home()))
    return local / "HarmonyCanvas" / "sketches.json"


def default_sketch() -> dict:
    now = utcnow()
    return {
        "id": str(uuid.uuid4()),
        "title": "D Aeolian sketch",
        "tonic": "D",
        "mode": "minor",
        "bpm": 120,
        "meter": "4/4",
        "chord_input": "Bb/D Am/E C Dm13/A",
        "chord_beats": [8, 8, 8, 8],
        "chord_starts": [0, 8, 16, 24],
        "melody": normalise_melody([
            {"pitch": 62, "start": 0, "duration": 1, "velocity": 100, "voice": 1},
            {"pitch": 65, "start": 1, "duration": 1, "velocity": 100, "voice": 1},
            {"pitch": 69, "start": 8, "duration": 2, "velocity": 100, "voice": 1},
            {"pitch": 67, "start": 16, "duration": 1, "velocity": 100, "voice": 1},
        ]),
        "notes": "",
        "created_at": now,
        "updated_at": now,
    }


class SketchStore:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.RLock()

    def _read_unlocked(self) -> list[dict]:
        if not self.path.exists():
            return []
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []
        return payload if isinstance(payload, list) else []

    def _write_unlocked(self, sketches: list[dict]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(json.dumps(sketches, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.path)

    def ensure_seed(self) -> None:
        with self.lock:
            if self._read_unlocked():
                return
            self._write_unlocked([default_sketch()])

    def list(self, instance_id: str | None = None, include_all: bool = False) -> list[dict]:
        with self.lock:
            sketches = self._read_unlocked()
            if not include_all and instance_id:
                sketches = [
                    item for item in sketches
                    if item.get("instance_id") == instance_id
                    or instance_id in (item.get("linked_instances") or [])
                ]
            return sorted(sketches, key=lambda item: item.get("updated_at", ""), reverse=True)

    def get(self, sketch_id: str) -> dict | None:
        with self.lock:
            return next((item for item in self._read_unlocked() if item.get("id") == sketch_id), None)

    def create(self, payload: dict) -> dict:
        now = utcnow()
        sketch = default_sketch()
        sketch.update({
            "id": str(uuid.uuid4()),
            "title": str(payload.get("title") or "Новый эскиз"),
            "tonic": str(payload.get("tonic") or "C"),
            "mode": str(payload.get("mode") or "major"),
            "bpm": max(30, min(300, int(payload.get("bpm") or 120))),
            "meter": str(payload.get("meter") or "4/4"),
            "chord_input": str(payload.get("chord_input") or ""),
            "chord_beats": list(payload.get("chord_beats") or []),
            "chord_starts": list(payload.get("chord_starts") or []),
            "melody": normalise_melody(payload.get("melody") or []),
            "notes": str(payload.get("notes") or ""),
            "created_at": now,
            "updated_at": now,
        })
        instance_id = str(payload.get("instance_id") or "").strip()
        if instance_id:
            sketch["instance_id"] = instance_id
        with self.lock:
            sketches = self._read_unlocked()
            sketches.append(sketch)
            self._write_unlocked(sketches)
        return sketch

    def get_or_create_for_instance(self, instance_id: str) -> dict:
        instance_id = str(instance_id or "").strip()
        if not instance_id:
            raise ValueError("Instance ID is required")
        with self.lock:
            sketches = self._read_unlocked()
            # An explicit link to a shared sketch (multi-instance sync) wins over
            # the instance's own sketch, so several plug-ins can edit one sketch.
            linked = next(
                (item for item in sketches if instance_id in (item.get("linked_instances") or [])),
                None,
            )
            if linked is not None:
                return linked
            owned = [item for item in sketches if item.get("instance_id") == instance_id]
            if owned:
                return max(owned, key=lambda item: item.get("updated_at", ""))

            # One-time migration: the first VST instance opened after this
            # update adopts the most recently edited legacy sketch.
            legacy = [item for item in sketches if not item.get("instance_id")]
            if legacy:
                sketch = max(legacy, key=lambda item: item.get("updated_at", ""))
                sketch["instance_id"] = instance_id
                sketch["updated_at"] = utcnow()
                self._write_unlocked(sketches)
                return sketch

            return self.create({
                "title": "Новый эскиз",
                "tonic": "C",
                "mode": "major",
                "bpm": 120,
                "instance_id": instance_id,
            })

    def bind_instance(self, instance_id: str, sketch_id: str | None) -> dict | None:
        """Link an instance to a shared sketch (or unlink when sketch_id is None).

        Returns the sketch the instance now resolves to, or None when a target
        sketch id was given but no such sketch exists.
        """
        instance_id = str(instance_id or "").strip()
        if not instance_id:
            raise ValueError("Instance ID is required")
        with self.lock:
            sketches = self._read_unlocked()
            # Drop any previous link for this instance so links stay exclusive.
            for item in sketches:
                links = item.get("linked_instances")
                if links and instance_id in links:
                    item["linked_instances"] = [x for x in links if x != instance_id]
            target = None
            if sketch_id:
                target = next((item for item in sketches if item.get("id") == sketch_id), None)
                if target is None:
                    return None
                links = target.setdefault("linked_instances", [])
                if instance_id not in links:
                    links.append(instance_id)
            self._write_unlocked(sketches)
        if target is not None:
            return target
        # Unlinked: fall back to the instance's own (or a fresh) sketch.
        return self.get_or_create_for_instance(instance_id)

    def update(self, sketch_id: str, payload: dict) -> dict | None:
        with self.lock:
            sketches = self._read_unlocked()
            sketch = next((item for item in sketches if item.get("id") == sketch_id), None)
            if sketch is None:
                return None
            allowed = {"title", "tonic", "mode", "bpm", "meter", "chord_input", "chord_beats", "chord_starts", "melody", "notes"}
            for key, value in payload.items():
                if key not in allowed:
                    continue
                if key == "melody":
                    sketch[key] = normalise_melody(value or [])
                elif key == "bpm":
                    sketch[key] = max(30, min(300, int(value)))
                else:
                    sketch[key] = value
            sketch["updated_at"] = utcnow()
            self._write_unlocked(sketches)
            return sketch

    def delete(self, sketch_id: str) -> bool:
        with self.lock:
            sketches = self._read_unlocked()
            remaining = [item for item in sketches if item.get("id") != sketch_id]
            if len(remaining) == len(sketches):
                return False
            self._write_unlocked(remaining)
            return True


def _smf_varlen(value: int) -> bytes:
    out = bytearray([value & 0x7F])
    value >>= 7
    while value:
        out.insert(0, (value & 0x7F) | 0x80)
        value >>= 7
    return bytes(out)


def _write_smf(path: Path, notes: list[tuple[float, float, int]], bpm: float, velocity: int) -> None:
    """Write a one-track type-0 MIDI file. notes = (start_beat, dur_beat, pitch)."""
    import struct

    ppq = 480
    events: list[tuple[int, int, int, int, int]] = []
    for start, dur, pitch in notes:
        on = int(round(start * ppq))
        off = max(on + 1, int(round((start + dur) * ppq)))
        events.append((on, 1, 0x90, pitch, velocity))
        events.append((off, 0, 0x80, pitch, 0))
    events.sort(key=lambda e: (e[0], e[1]))

    track = bytearray()
    mpq = int(round(60000000 / max(1.0, bpm)))
    track += _smf_varlen(0) + bytes([0xFF, 0x51, 0x03]) + struct.pack(">I", mpq)[1:]
    last = 0
    for tick, _order, status, d1, d2 in events:
        track += _smf_varlen(tick - last) + bytes([status, d1, d2])
        last = tick
    track += _smf_varlen(0) + bytes([0xFF, 0x2F, 0x00])
    data = b"MThd" + struct.pack(">IHHH", 6, 0, 1, ppq) + b"MTrk" + struct.pack(">I", len(track)) + bytes(track)
    path.write_bytes(data)


def export_sketch_midi(sketch: dict) -> dict:
    """Write one .mid per part (chords + each voice) into a folder and open it."""
    advice = build_advice(sketch, {})
    bpm = float(sketch.get("bpm") or 120)
    base = Path.home() / "OneDrive" / "Desktop"
    if not base.is_dir():
        base = Path.home() / "Desktop"
    if not base.is_dir():
        base = Path.home()
    title = "".join(c for c in str(sketch.get("title") or "sketch") if c.isalnum() or c in " -_").strip() or "sketch"
    folder = base / "HarmonyCanvas-MIDI" / title
    folder.mkdir(parents=True, exist_ok=True)

    made: list[str] = []
    chord_notes = [
        (float(chord["start"]), float(chord["beats"]) * 0.98, int(pitch))
        for chord in advice.get("chords", []) for pitch in chord.get("midi", [])
    ]
    if chord_notes:
        _write_smf(folder / "Chords.mid", chord_notes, bpm, 80)
        made.append("Chords.mid")
    by_voice: dict[int, list[tuple[float, float, int]]] = {}
    for note in advice.get("melody", []):
        voice = int(note.get("voice") or 1)
        by_voice.setdefault(voice, []).append((float(note["start"]), float(note["duration"]) * 0.98, int(note["pitch"])))
    for voice in sorted(by_voice):
        name = f"Voice {voice}.mid"
        _write_smf(folder / name, by_voice[voice], bpm, 100)
        made.append(name)

    try:
        if os.name == "nt":
            os.startfile(str(folder))  # type: ignore[attr-defined]
    except OSError:
        pass
    return {"folder": str(folder), "files": made}


def build_advice(sketch: dict, query: dict[str, list[str]]) -> dict:
    selected_raw = query.get("selected_index", [None])[0]
    selected = int(selected_raw) if selected_raw not in (None, "") else None
    chromatic = query.get("chromatic", ["false"])[0].lower() in {"1", "true", "yes"}
    try:
        octave = int(query.get("octave", ["0"])[0])
    except (TypeError, ValueError):
        octave = 0
    result = analyze_sketch(
        chord_input=sketch.get("chord_input", ""),
        tonic=sketch.get("tonic", "C"),
        mode=sketch.get("mode", "major"),
        melody=sketch.get("melody", []),
        selected_index=selected,
        palette_mode=query.get("palette_mode", [None])[0],
        palette_secondary=query.get("palette_secondary", [None])[0],
        chord_beats=sketch.get("chord_beats", []),
        chord_starts=sketch.get("chord_starts", []),
        chromatic=chromatic,
        meter=sketch.get("meter", "4/4"),
        octave=octave,
    )
    result["chord_input"] = sketch.get("chord_input", "")
    result["midi_files"] = []
    result["source_policy"] = {
        "manual_chords": "author_intent",
        "midi": "performed_evidence",
        "merge": "explicit_only",
    }
    return result


class HarmonyCanvasHandler(BaseHTTPRequestHandler):
    server_version = "HarmonyCanvas/0.1"

    @property
    def store(self) -> SketchStore:
        return self.server.store  # type: ignore[attr-defined]

    def log_message(self, format: str, *args) -> None:
        print(f"[HarmonyCanvas] {self.address_string()} {format % args}")

    def send_json(self, payload, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status: int, detail: str) -> None:
        self.send_json({"detail": detail}, status)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ValueError("Некорректный JSON") from error
        if not isinstance(payload, dict):
            raise ValueError("JSON payload должен быть объектом")
        return payload

    def serve_static(self, request_path: str) -> None:
        relative = "index.html" if request_path == "/" else request_path.removeprefix("/static/")
        candidate = (WEB_ROOT / unquote(relative)).resolve()
        if WEB_ROOT.resolve() not in candidate.parents and candidate != WEB_ROOT.resolve():
            self.send_error_json(HTTPStatus.FORBIDDEN, "Forbidden")
            return
        if not candidate.is_file():
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found")
            return
        body = candidate.read_bytes()
        content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8" if content_type.startswith("text/") or content_type.endswith("javascript") else content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def route_parts(self) -> tuple[list[str], dict[str, list[str]]]:
        parsed = urlparse(self.path)
        parts = [unquote(part) for part in parsed.path.strip("/").split("/") if part]
        return parts, parse_qs(parsed.query)

    def do_GET(self) -> None:
        parts, query = self.route_parts()
        if not parts or parts[0] == "static":
            self.serve_static(urlparse(self.path).path)
            return
        if parts == ["api", "health"]:
            self.send_json({"ok": True, "service": "harmony-canvas-sidecar"})
            return
        if parts == ["api", "transport"]:
            with self.server.transport_lock:  # type: ignore[attr-defined]
                self.send_json(dict(self.server.transport))  # type: ignore[attr-defined]
            return
        if parts == ["api", "sketches"]:
            include_all = query.get("all", [None])[0] in ("1", "true", "yes")
            self.send_json(self.store.list(query.get("instance", [None])[0], include_all=include_all))
            return
        if len(parts) == 4 and parts[:2] == ["api", "instances"] and parts[3] == "sketch":
            try:
                self.send_json(self.store.get_or_create_for_instance(parts[2]))
            except ValueError as error:
                self.send_error_json(HTTPStatus.BAD_REQUEST, str(error))
            return
        if len(parts) >= 3 and parts[:2] == ["api", "sketches"]:
            sketch = self.store.get(parts[2])
            if sketch is None:
                self.send_error_json(HTTPStatus.NOT_FOUND, "Эскиз не найден")
                return
            if len(parts) == 3:
                self.send_json(sketch)
                return
            if parts[3] == "advice":
                self.send_json(build_advice(sketch, query))
                return
            if parts[3] == "midi":
                self.send_json([])
                return
        self.send_error_json(HTTPStatus.NOT_FOUND, "Not found")

    def do_POST(self) -> None:
        parts, _ = self.route_parts()
        try:
            payload = self.read_json()
        except ValueError as error:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(error))
            return
        if parts == ["api", "shutdown"]:
            self.send_json({"ok": True, "shutting_down": True})
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return
        if parts == ["api", "transport"]:
            with self.server.transport_lock:  # type: ignore[attr-defined]
                state = self.server.transport  # type: ignore[attr-defined]
                if "playing" in payload:
                    state["playing"] = bool(payload.get("playing"))
                if "position" in payload:
                    try:
                        state["position"] = float(payload.get("position") or 0.0)
                    except (TypeError, ValueError):
                        pass
                state["seq"] += 1
                self.send_json(dict(state))
            return
        if parts == ["api", "mode-chord"]:
            # The characteristic tonic chord of a mode from a given root, spelled
            # with the mode's own tensions (Dorian -> m13, Lydian -> maj13(#11)).
            from sidecar.harmony_engine import _mode_context, degree_state, compose_symbol
            root = str(payload.get("root") or "C")
            mode = str(payload.get("mode") or "major")
            ctype = str(payload.get("type") or "13")
            tonic_pc, intervals, flats = _mode_context(root, mode)
            build = lambda lv: compose_symbol(degree_state(tonic_pc, intervals, 0, flats, {"type": lv}))
            self.send_json({"symbol": build(ctype), "variants": [{"level": lv, "symbol": build(lv)} for lv in ("7", "9", "11", "13")]})
            return
        if parts == ["api", "degree-chord"]:
            # The diatonic chord whose root is `root`, read as a scale degree
            # within `tonic` `mode` (chord B seen inside chord A's key).
            from sidecar.harmony_engine import _mode_context, degree_state, compose_symbol, _root_pc
            tonic = str(payload.get("tonic") or "C")
            mode = str(payload.get("mode") or "major")
            root = str(payload.get("root") or "C")
            ctype = str(payload.get("type") or "13")
            tonic_pc, intervals, flats = _mode_context(tonic, mode)
            root_pc = _root_pc(root)
            root_pc = tonic_pc if root_pc is None else root_pc
            distance = (root_pc - tonic_pc) % 12
            degree = intervals.index(distance) if distance in intervals else min(
                range(7), key=lambda i: min((distance - intervals[i]) % 12, (intervals[i] - distance) % 12))
            build = lambda lv: compose_symbol(degree_state(tonic_pc, intervals, degree, flats, {"type": lv}))
            self.send_json({"symbol": build(ctype), "diatonic": distance in intervals, "variants": [{"level": lv, "symbol": build(lv)} for lv in ("7", "9", "11", "13")]})
            return
        if parts == ["api", "pair-mood"]:
            # Stateless: mood + voicing for any ordered chord pair (dial popup).
            from sidecar import ptm_analysis
            from sidecar.harmony_engine import parse_chord as parse_full

            def info(symbol: str) -> dict:
                symbol = str(symbol or "").strip()
                full = parse_full(symbol)
                return {"symbol": symbol, "midi": full["midi"] if full else [], "valid": bool(full)}

            a_sym = str(payload.get("a") or "").strip()
            b_sym = str(payload.get("b") or "").strip()
            ca, cb = ptm_analysis.parse_chord(a_sym), ptm_analysis.parse_chord(b_sym)
            mood = ptm_analysis.pair_mood(ca, cb) if (ca and cb) else None
            self.send_json({"a": info(a_sym), "b": info(b_sym), "mood": mood})
            return
        if parts == ["api", "sketches"]:
            self.send_json(self.store.create(payload), HTTPStatus.CREATED)
            return
        if len(parts) == 4 and parts[:2] == ["api", "instances"] and parts[3] == "bind":
            try:
                sketch_id = str(payload.get("sketch_id") or "").strip() or None
                result = self.store.bind_instance(parts[2], sketch_id)
            except ValueError as error:
                self.send_error_json(HTTPStatus.BAD_REQUEST, str(error))
                return
            if result is None:
                self.send_error_json(HTTPStatus.NOT_FOUND, "Эскиз не найден")
                return
            self.send_json(result)
            return
        if len(parts) == 4 and parts[:2] == ["api", "sketches"]:
            sketch = self.store.get(parts[2])
            if sketch is None:
                self.send_error_json(HTTPStatus.NOT_FOUND, "Эскиз не найден")
                return
            if parts[3] == "chord-edit":
                chord_input, selected, beats, starts = apply_chord_edit(
                    sketch.get("chord_input", ""),
                    index=int(payload.get("index", 0)),
                    op=str(payload.get("op", "")),
                    value=str(payload.get("value", "")),
                    tonic=sketch.get("tonic", "C"),
                    mode=sketch.get("mode", "major"),
                    chord_beats=sketch.get("chord_beats", []),
                    chord_starts=sketch.get("chord_starts", []),
                    start=payload.get("start"),
                )
                updated = self.store.update(parts[2], {"chord_input": chord_input, "chord_beats": beats, "chord_starts": starts})
                query = {
                    "selected_index": [str(selected)],
                    "palette_mode": [str(payload.get("palette_mode") or "")],
                    "palette_secondary": [str(payload.get("palette_secondary") or "")],
                    "chromatic": [str(bool(payload.get("chromatic", False))).lower()],
                    "octave": [str(int(payload.get("octave", 0) or 0))],
                }
                self.send_json(build_advice(updated, query))
                return
            if parts[3] == "note-edit":
                melody, selected_note = apply_note_edit(
                    sketch.get("melody", []),
                    op=str(payload.get("op", "")),
                    index=payload.get("index"),
                    pitch=payload.get("pitch"),
                    start=payload.get("start"),
                    duration=payload.get("duration"),
                    voice=payload.get("voice"),
                )
                updated = self.store.update(parts[2], {"melody": melody})
                query = {
                    "selected_index": [str(payload.get("selected_index", -1))],
                    "palette_mode": [str(payload.get("palette_mode") or "")],
                    "palette_secondary": [str(payload.get("palette_secondary") or "")],
                    "chromatic": [str(bool(payload.get("chromatic", False))).lower()],
                    "octave": [str(int(payload.get("octave", 0) or 0))],
                }
                result = build_advice(updated, query)
                result["selected_note"] = selected_note
                self.send_json(result)
                return
            if parts[3] == "export-midi":
                try:
                    self.send_json(export_sketch_midi(sketch))
                except OSError as error:
                    self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, str(error))
                return
        self.send_error_json(HTTPStatus.NOT_FOUND, "Not found")

    def do_PATCH(self) -> None:
        parts, _ = self.route_parts()
        if len(parts) != 3 or parts[:2] != ["api", "sketches"]:
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found")
            return
        try:
            payload = self.read_json()
        except ValueError as error:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(error))
            return
        sketch = self.store.update(parts[2], payload)
        if sketch is None:
            self.send_error_json(HTTPStatus.NOT_FOUND, "Эскиз не найден")
            return
        self.send_json(sketch)

    def do_DELETE(self) -> None:
        parts, _ = self.route_parts()
        if len(parts) == 3 and parts[:2] == ["api", "sketches"] and self.store.delete(parts[2]):
            self.send_response(HTTPStatus.NO_CONTENT)
            self.end_headers()
            return
        self.send_error_json(HTTPStatus.NOT_FOUND, "Эскиз не найден")


class HarmonyCanvasServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, store: SketchStore):
        super().__init__(address, HarmonyCanvasHandler)
        self.store = store
        # Transport command from the editor. A Max for Live device polls this and
        # starts/stops Ableton's transport, so the app drives playback. `seq`
        # bumps on every change so pollers act only on real transitions.
        self.transport = {"playing": False, "position": 0.0, "seq": 0}
        self.transport_lock = threading.Lock()


def stop_with_parent(server: ThreadingHTTPServer, parent_pid: int) -> None:
    """Shut down the sidecar when its Ableton host process exits on Windows."""
    if os.name != "nt" or parent_pid <= 0:
        return
    synchronize = 0x00100000
    infinite = 0xFFFFFFFF
    kernel32 = ctypes.windll.kernel32
    handle = kernel32.OpenProcess(synchronize, False, parent_pid)
    if not handle:
        return
    try:
        kernel32.WaitForSingleObject(handle, infinite)
    finally:
        kernel32.CloseHandle(handle)
    server.shutdown()


def run(
    host: str = "127.0.0.1",
    port: int = 8787,
    data_file: Path | None = None,
    parent_pid: int = 0,
) -> None:
    store = SketchStore(data_file or default_data_file())
    store.ensure_seed()
    server = HarmonyCanvasServer((host, port), store)
    if parent_pid:
        threading.Thread(target=stop_with_parent, args=(server, parent_pid), daemon=True).start()
    print(f"Harmony Canvas sidecar: http://{host}:{port}/?focus=lab")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Harmony Canvas standalone local server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--data", type=Path, default=None)
    parser.add_argument("--parent-pid", type=int, default=0)
    args = parser.parse_args()
    run(args.host, args.port, args.data, args.parent_pid)


if __name__ == "__main__":
    main()
