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
