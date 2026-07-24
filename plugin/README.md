# JUCE WebView VST3 shell

The plug-in embeds the Harmony Canvas web editor with JUCE 8 and WebView2. In a
packaged build it starts `HarmonyCanvasSidecar.exe` from
`Contents/Resources/`, waits for `127.0.0.1:8787`, and opens:

```text
http://127.0.0.1:8787/?focus=lab&instance=<persistent-instance-id>
```

The instance ID is stored in the plug-in state. A restored instance reclaims
its sketch; duplicating a currently active instance keeps a fresh ID so both
copies do not edit the same MIDI.

## Native responsibilities

- WebView2 lifecycle and JavaScript/native events;
- preview note-on/note-off MIDI;
- host transport snapshots (tempo, PPQ, meter and play state);
- sample-block timeline playback in `AudioProcessor::processBlock`;
- persistent per-instance identity;
- packaged sidecar discovery, startup and final-instance shutdown request.

Timeline playback intentionally lives in the processor rather than the editor.
Destroying or hiding the editor must therefore not stop playback.

## Play/Stop → Ableton transport

Ableton Live denies VST3 plug-ins transport control: inside Live,
`AudioPlayHead::canControlTransport()` is `false`, so `transportPlay()` in
`processBlock` is silently dropped and the editor's Play button cannot start the
host. Only the reverse direction (Live tempo/PPQ/play state → editor playhead)
works from the plug-in itself.

To let Play/Stop actually drive Live, the sidecar auto-launches an AbletonJS
bridge (`bridge/transport-sync.mjs`) as a child process on startup — see
`launch_transport_bridge()` in `sidecar/server.py`. The editor POSTs each
Play/Stop to the sidecar's `/api/transport`; the bridge watches that and calls
Live's `start_playing` / `stop_playing`. Nothing to run by hand.

Requirements for the auto-launch to actually reach Live:

- Live is open, with its **AbletonJS** control surface enabled
  (Preferences → Link/MIDI → Control Surface = AbletonJS);
- a system-wide **Node.js** on the machine running Ableton (the packaged
  plug-in bundles the bridge script and its `node_modules`, but not a Node
  runtime — PyInstaller only bundles data, not other language runtimes).

Either piece missing degrades safely: the sidecar logs why it skipped the
bridge and Play/Stop simply stays read-only (Live still drives the editor's
playhead, same as before this bridge existed).

The bridge's own stdout/stderr — including its Ableton connection state and
every relayed Play/Stop — go to
`%TEMP%\HarmonyCanvas-transport-bridge.log` (overwritten each sidecar start),
since the packaged sidecar runs `--noconsole` and has nowhere else to print.
Check that file first when Play/Stop doesn't reach Live.

To run the bridge by hand (e.g. against a sidecar started with
`--no-bridge`, or while iterating on the bridge itself):

```bash
cd bridge
npm install                 # first time only
npm run transport:sync
```

Flags: `--host`, `--port` (sidecar, default `127.0.0.1:8787`) and `--poll-ms`
(default `120`).

## Local build

```powershell
cmake -S plugin -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release --target HarmonyCanvas_VST3
```

JUCE 8.0.13 is fetched by CMake. A local build does not automatically package a
sidecar unless it is copied into the VST3 resources; use
`HARMONY_CANVAS_SIDECAR` or `HARMONY_CANVAS_LAB_URL` during development.

## CI build

`.github/workflows/build-windows.yml` creates and smoke-tests the PyInstaller
sidecar, builds the VST3, embeds the executable and uploads the complete bundle
as `HarmonyCanvas-Windows-VST3` for 14 days.
