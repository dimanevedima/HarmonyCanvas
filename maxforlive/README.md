# Harmony Canvas Player (Max for Live)

A lightweight device that plays **only the checked parts** of a Harmony Canvas
sketch on the track it sits on, in sync with the Live transport.

## Why this exists

Ableton Live merges all internally-routed MIDI onto one channel, so a single
Harmony Canvas plug-in cannot fan its parts out to several instruments by MIDI
channel (Scaler documents the same limit). Instead of routing MIDI *through*
Live, this device **generates the MIDI locally**: it pulls the sketch from the
Harmony Canvas sidecar over HTTP and plays the parts you enable. Put one on each
instrument track, tick different parts, and one composition drives many
instruments — no channel tricks.

```text
   Harmony Canvas editor (VST or browser)  ──writes──▶  sidecar (127.0.0.1:8787)
                                                              ▲ HTTP GET
        Track A: [Harmony Canvas Player  ☑Chords]  ───────────┤
        Track B: [Harmony Canvas Player  ☑Voice 2] ───────────┘
```

## Files

| File | Role |
|------|------|
| `harmonycanvas_router.js` | Max `[js]` — transport-synced playback of the enabled parts (ES5, also runs under Node for tests). |
| `harmonycanvas_fetch.js`  | Max `[node.script]` — polls the sidecar, resolves the sketch, sends it to the router. |
| `HarmonyCanvasPlayer.maxpat` | The wired patch (checkboxes + fetch + player + `midiout`). |
| `test-router.js` | `node maxforlive/test-router.js` — 15 scheduling checks. |

## Assemble the device

1. In Ableton, create a **Max MIDI Effect** and click **Edit** to open Max.
2. Open `HarmonyCanvasPlayer.maxpat` (or copy its objects into the device patch),
   keeping the M4L `[midiin]`/`[midiout]` scaffold — the player feeds `[midiout]`.
3. Put `harmonycanvas_router.js` and `harmonycanvas_fetch.js` next to the device
   (or anywhere in the Max search path). `node.script` needs the Node runtime
   that ships with Max.
4. **Freeze** the device (so the two `.js` files travel inside the `.amxd`) and
   save it, e.g. `Harmony Canvas Player.amxd`.

Two things to check while wiring (couldn't verify without Max here):

- **`[midiout]` input** — the router sends `[status note velocity]` lists
  (`144 note vel` / `128 note 0`). If `[midiout]` doesn't sound them directly,
  insert `[midiformat]` before it.
- **JSON as one atom** — `node.script` should hand the sketch JSON to
  `[prepend sketch]` as a single symbol. If it arrives split, pass it through a
  `[dict]` / `[dict.deserialize]` instead.

## Use it

1. Have a Harmony Canvas editor running so the sidecar is up on port 8787:
   the VST starts it automatically, or run it yourself —
   `python -m sidecar.server --port 8787` — and edit at
   `http://127.0.0.1:8787/?focus=lab`.
2. Drop **Harmony Canvas Player** on each instrument track.
3. Tick the parts each track should play (Chords, Voice 1–4). By default it
   follows the **most recently edited** sketch; the `status` field shows the id.
4. Press play in Live. Edits in the editor are picked up within ~1 s.

The device reads the shared sidecar, so no MIDI routing from the Harmony Canvas
plug-in is needed — the plug-in is just the editor.
