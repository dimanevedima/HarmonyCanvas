# Harmony Canvas

Harmony Canvas — harmony-aware MIDI sketchpad for Ableton Live 12. It embeds the
existing Harmony Lab HTML/CSS/JavaScript editor in a JUCE VST3 through WebView2,
then sends its MIDI output to a normal Ableton instrument track.

The goal is a Hookpad-like workflow inside Live: write melodies, bass lines and
additional voices over a changing chord progression while the piano roll shows
the harmonic role of every pitch.

> Current state (22 July 2026): working Windows prototype tested in Ableton Live
> 12.4.3. This is not yet a distributable release.

## What works now

- the full Harmony Lab editor opens inside the VST3;
- chord palettes, chord lane/editor and harmony-aware note colours work;
- note/chord preview is emitted as MIDI by the plug-in;
- the editor follows Ableton tempo, meter, play state and PPQ position;
- timeline playback is rendered in the audio processor, so editing notes or
  closing the plug-in window does not interrupt DAW playback;
- each plug-in instance stores a persistent identity in plug-in state and owns
  an isolated sketch in the local sidecar store; duplicating a live instance
  creates a new identity;
- the packaged sidecar starts automatically from the VST3 bundle and receives a
  shutdown request when the final Harmony Canvas instance is destroyed;
- the compact plug-in UI removes the unrelated lower laboratory sections.

The usual routing is:

```text
HARMONY CANVAS (VST3)
    ↓ MIDI From
MIDI BRIDGE — Monitor In
    ↓ MIDI To
INSTRUMENT / RECORDING TRACK
```

## Voices and per-instance output

The editor supports up to four melody voices plus the chord lane. Pick the
active voice in the "Голос" bar (or press 1–4): the active voice keeps its
harmonic-role colours and is the only one you can edit, while the other voices
stay visible but greyed and locked.

The "Выводит этот инстанс" bar decides which parts this plug-in instance sends
during DAW playback — the chords and each voice have an on/off toggle. That
choice is remembered per instance (in the WebView store), so it survives
reopening the plug-in. Muting a part also silences it in the built-in preview.

Each part is emitted on its own MIDI channel (chords → Ch 1, voice N → Ch N+1).
That per-channel split works for direct routing in Logic Pro 11, Cubase and
Reaper. **Ableton Live is different:** it merges all internally-routed MIDI onto
one channel, so you cannot split one instance's output to several instruments by
channel there — the same limitation Scaler documents for Ableton.

### Routing parts to separate instruments in Ableton

Because Ableton collapses channels, use one Harmony Canvas instance per
instrument, all sharing a single sketch:

1. Add a Harmony Canvas instance on each instrument track (or a MIDI-source
   track feeding it), plus the one you compose in.
2. In every extra instance, open the "Эскиз" picker in the voices bar and select
   the sketch you are composing in — that instance now edits the **same shared
   sketch**, and edits sync live between instances.
3. In each instance's "Выводит этот инстанс" bar, leave only that instance's
   part enabled (e.g. one instance outputs chords, another outputs voice 2).
4. Point each instrument track's `MIDI From` at its Harmony Canvas instance.

This mirrors Scaler's multi-instance sync workflow and is the reliable way to
drive different instruments live from one composition inside Ableton. For a
one-off split you can instead drag/export each part as its own MIDI clip.

## Important handoff note

The latest Ableton shutdown hang was investigated with a full ProcDump/WinDbg
dump. The blocking stack is in Max for Live `MaxPlug.dll`, specifically an
`udpreceive` worker waiting in `recvfrom`; it is not in Harmony Canvas, WebView2
or the sidecar. Port `9881` is used by these local LivePilot devices:

- `LivePilot_Analyzer.amxd`;
- `LivePilot_MIDITool_Generate.amxd`;
- `LivePilot_MIDITool_Transform.amxd`.

`urr228.amxd` has a separate missing `chrome_samples_hotfolder.js` dependency,
but contains no `udpreceive` object. See [current handoff](docs/HANDOFF.md) for
evidence, remaining risks and the next test.

## Build

Requirements: CMake 3.22+, Visual Studio 2022 with Desktop development with C++,
and Microsoft WebView2 Runtime.

```powershell
cmake -S plugin -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release --target HarmonyCanvas_VST3
```

The GitHub Actions workflow builds a one-file Python sidecar, smoke-tests it,
builds the VST3 and places `HarmonyCanvasSidecar.exe` in the VST3 resources.
Download the `HarmonyCanvas-Windows-VST3` artifact and copy the entire
`Harmony Canvas.vst3` bundle to:

```text
C:\Program Files\Common Files\VST3\
```

The current packaged build is produced by workflow run 11 from commit
`af19efa`. Environment overrides for development:

- `HARMONY_CANVAS_LAB_URL` — use an externally hosted development UI;
- `HARMONY_CANVAS_SIDECAR` — explicit path to the sidecar executable;
- `HARMONY_CANVAS_DATA` — explicit sketch storage file.

## Development and tests

Run the sidecar directly:

```powershell
python -m sidecar.server --port 8787
```

Run the automated checks:

```powershell
python -m pytest sidecar/tests
node bridge/test-protocol.mjs
node --check web/app.js
```

The last verified local result was 53 Python tests and 2 Node protocol tests
passing, plus a successful JavaScript syntax check.

## Repository map

```text
bridge/         AbletonJS Pull/Commit experiment and protocol tests
docs/           product spec, architecture, backlog and current handoff
plugin/         JUCE VST3/Standalone WebView shell and native MIDI playback
plugdata/       archived visual spike; not the product shell
protocol/       versioned JSON contracts
sidecar/        standalone local HTTP backend and harmony engine
tests/          fixtures and captured bridge payloads
web/            embedded Harmony Lab frontend
```

## Documents

- [Current handoff and known issues](docs/HANDOFF.md)
- [Product backlog](docs/PRODUCT_BACKLOG.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Product specification](docs/PRODUCT_SPEC.md)
- [Bridge protocol](protocol/README.md)
