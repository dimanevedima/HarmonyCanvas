# Harmony Canvas sidecar

Standalone local HTTP backend for the embedded editor. It uses the Python
standard library and does not import ReferenceCompare, FastAPI or its database.

```powershell
python -m sidecar.server --host 127.0.0.1 --port 8787
```

Open `http://127.0.0.1:8787/?focus=lab`. The packaged VST3 starts the sidecar
automatically with Ableton's PID and its own `instance` query parameter.

## State

Sketches are written atomically to:

```text
%LOCALAPPDATA%\HarmonyCanvas\sketches.json
```

Override this with `--data` or `HARMONY_CANVAS_DATA`. Sketches are partitioned
by persistent plug-in instance ID. On first upgrade, the first instance claims
the newest legacy sketch without an owner; later new instances receive separate
sketches.

## Lifecycle

- `--parent-pid` stops the server when the Ableton process exits;
- `POST /api/shutdown` requests a clean immediate shutdown;
- the VST3 calls that endpoint when its final processor instance is destroyed;
- if another sidecar is already listening on port 8787, new editors reuse it.

## Tests

```powershell
python -m pytest sidecar/tests
```

The tests cover harmony editing, instance isolation, legacy migration and the
explicit shutdown endpoint.
