# Implementation plan

Status updated 22 July 2026. Detailed context and the current external shutdown
issue are in [HANDOFF.md](HANDOFF.md).

## M0 — contracts and read-only Ableton bridge

- [x] product and architecture specifications;
- [x] versioned JSON contracts;
- [x] AbletonJS `Pull Selected Clip` CLI;
- [x] validation against a real Live MIDI clip;
- [x] fixture and protocol tests.

## M1 — embedded working prototype

- [x] validate the visual idea in plugdata;
- [x] separate Harmony Canvas from ReferenceCompare;
- [x] port the existing Harmony Lab UI, harmony engine and editor;
- [x] JUCE 8 VST3/Standalone shell with WebView2;
- [x] JavaScript-to-native MIDI preview;
- [x] packaged one-file sidecar bundled with the VST3;
- [x] Windows GitHub Actions build and smoke test;
- [x] working MIDI routing to an Ableton instrument track;
- [x] remove unrelated lower laboratory sections from plug-in mode.

## M2 — DAW transport and reliable playback

- [x] receive host BPM, meter, PPQ and play state;
- [x] show Ableton tempo in the compact transport;
- [x] render timeline playback in the audio processor;
- [x] preserve playback while notes are added/edited;
- [x] preserve playback when the plug-in editor closes;
- [x] send All Notes Off on stop/jump;
- [ ] expose and test explicit editor loop boundaries against host PPQ;
- [ ] run a broader transport regression: start mid-note, seek, loop, tempo
  automation and meter changes.

## M3 — instance state and lifecycle

- [x] persistent plug-in instance UUID (`harmony-canvas-state-v2`);
- [x] isolated sidecar sketches per instance;
- [x] new identity when an active instance is duplicated;
- [x] one-time claim of legacy unowned sketches;
- [x] explicit sidecar shutdown endpoint and parent-PID fallback;
- [ ] embed the full musical snapshot in plug-in state so a Live Set is
  self-contained and portable;
- [ ] define deterministic merge/recovery behaviour when local and embedded
  snapshots differ;
- [ ] test save/reload, Save As, track duplication and cross-project copying.

## M4 — core editor workflow

- [ ] full vertical MIDI 0–127 scrolling and useful default register;
- [ ] Undo/Redo with keyboard shortcuts;
- [ ] resizable loop edges and independent Loop On/Off;
- [ ] compact top bar: Play/Stop, tonic, mode and meter;
- [ ] compact text chord entry;
- [ ] chord block move/resize and palette-to-lane drag/drop;
- [ ] up to four voices with active-voice editing and locked ghost voices;
- [ ] focused regression for add/move/resize/delete/copy/paste.

## M5 — Live clip exchange and MIDI drag

- [ ] connect the existing AbletonJS Pull prototype to the embedded UI;
- [ ] clip locator and content fingerprint;
- [ ] safe Commit with conflict detection;
- [ ] Commit as New and Live Undo validation;
- [ ] native SMF drag-out;
- [ ] separate drag-out payloads for chords and melodies;
- [ ] managed temporary-file cleanup;
- [ ] polished Ableton routing template.

## M6 — release hardening

- [ ] resolve the external LivePilot `udpreceive 9881` shutdown deadlock or
  document a verified compatibility workaround;
- [ ] installer/uninstaller and versioned release artifacts;
- [ ] clean-machine installation test;
- [ ] performance checks with 2,000 notes;
- [ ] complete acceptance test from `PRODUCT_SPEC.md`;
- [ ] crash/hang diagnostics policy that does not leave multi-gigabyte dumps on
  the user's system.
