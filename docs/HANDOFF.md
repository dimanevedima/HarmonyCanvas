# Harmony Canvas — current handoff

Snapshot date: 22 July 2026. Branch: `main`.

## Last known good build

- source commit: `af19efa770535be18727ee1029c0a2d057220732`;
- GitHub Actions: run 11, successful;
- tested host: Ableton Live 12.4.3 on Windows;
- VST3 SHA-256:
  `03CDAFA07BB897527DEBADD5C57FC24A9BFEF583640E60DDE9AE37C9EC93FDBE`;
- packaged sidecar SHA-256:
  `8C65AF19784AD4EC06185DDF31DFF5CCE37BD56E5E36AA4BA2B00124D29EF05B`.

Manual checks confirmed:

1. the embedded UI opens and edits notes/chords;
2. MIDI reaches a routed instrument track;
3. DAW-synchronised playback works;
4. editing notes while Live plays no longer interrupts playback;
5. closing the plug-in window no longer interrupts playback;
6. two instances no longer share a sketch.

Automated checks at the handoff point: 53 Python tests, 2 Node protocol tests
and `node --check web/app.js` passed.

## Recent implementation decisions

### DAW playback

The Web UI sends a complete beat-based timeline through the JUCE event
`setPlaybackTimeline`. `HarmonyCanvasProcessor` atomically swaps an immutable
timeline and renders MIDI from the host PPQ inside `processBlock`. UI edits can
replace the timeline without resetting transport or sounding notes.

The editor only emits host transport snapshots to JavaScript. It is not the
owner of playback, so closing the editor is safe.

### Per-instance state

Processor state format `harmony-canvas-state-v2` stores a UUID. The sidecar API
maps that UUID to one sketch. If Ableton duplicates a track while the original
instance remains active, the duplicate keeps its constructor UUID instead of
claiming the same one.

This solves runtime isolation. A fuller state model is still needed for robust
cross-machine project transfer because the musical payload currently remains in
the local sidecar store rather than being embedded in the Live Set.

### Sidecar lifecycle

The first editor starts the packaged executable if port 8787 is not listening.
The sidecar also watches the Ableton parent PID. The last destroyed Harmony
Canvas processor sends `POST /api/shutdown`.

## Ableton shutdown hang: diagnosis

A full hang dump was captured with ProcDump and analysed in WinDbg. The dump was
deleted after analysis to recover disk space; the text analysis remains locally
under `.artifacts/hang-dumps/windbg-analysis.txt` and is intentionally ignored
by Git.

WinDbg reported:

```text
MODULE_NAME: MaxPlug
IMAGE_NAME: MaxPlug.dll
FAILURE_BUCKET_ID: APPLICATION_HANG_cfffffff_MaxPlug.dll!Unknown
```

The Ableton UI thread was waiting in `MaxPlug!systhread_join`. The worker it was
joining was blocked in:

```text
ws2_32!WSARecvFrom
wsock32!recvfrom
MaxPlug ... udpreceive!ext_main
```

This places the shutdown deadlock in a Max for Live `udpreceive` object, not in
Harmony Canvas, WebView2 or the Python sidecar. The hung Ableton process owned
UDP port 9881. Local files using `udpreceive 9881` are:

```text
User Library/Presets/Audio Effects/Max Audio Effect/LivePilot_Analyzer.amxd
User Library/MIDI Tools/Max Generators/LivePilot_MIDITool_Generate.amxd
User Library/MIDI Tools/Max Transformations/LivePilot_MIDITool_Transform.amxd
```

The likely next confirmation is to run the same Set without the LivePilot
Analyzer and without opening the two LivePilot MIDI Tools, then close Live. If
the hang disappears, patch the LivePilot Max devices to close/unbind their UDP
receiver before teardown and review the fact that all three compete for the
same fixed port.

`urr228.amxd` is also loaded and logs a missing
`chrome_samples_hotfolder.js`, but it contains no `udpreceive`; treat this as a
separate device packaging problem.

## Next product work

Highest-priority editor work agreed with the product owner:

1. vertical piano-roll scrolling over the full MIDI range;
2. Undo/Redo and keyboard shortcuts;
3. editable loop handles plus an independent Loop On/Off control;
4. more compact top bar and compact text chord input;
5. easier chord-lane editing and palette-to-lane drag/drop;
6. up to four voices, with only the active voice editable/highlighted;
7. separate MIDI drag-out for chords and melodies;
8. durable self-contained project state and complete Live Set restore;
9. Pull/Commit/Commit as New integration and Ableton template polish.

See `docs/PRODUCT_BACKLOG.md` for the wider list.

## Do not regress

- Do not move continuous playback back into the WebView/editor lifecycle.
- Do not key sketches only by a global latest-sketch value.
- Do not modify or delete the original Harmony Lab/ReferenceCompare project;
  Harmony Canvas is now a separate repository and product baseline.
- Do not attribute the observed Ableton exit hang to Harmony Canvas without a
  new dump showing a Harmony Canvas frame as the blocker.
