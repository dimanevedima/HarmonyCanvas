/*
 * harmonycanvas_router.js — core logic for the "Harmony Canvas Player" Max for
 * Live device.
 *
 * One Harmony Canvas editor (VST or a browser tab) keeps the sketch in the
 * local sidecar. This device sits on an instrument track in Ableton, is told
 * which parts to play via checkboxes (chords + voices 1-4), reads the Live
 * transport, and generates MIDI for only those parts — in sync with the host.
 *
 * Because the MIDI is generated locally from the sidecar's data (not routed
 * through Ableton), it sidesteps Live's internal channel merging: several
 * tracks can each play a different part of the same composition.
 *
 * The file is written in conservative ES5 so it runs both inside the Max [js]
 * object and under Node.js for the test harness. All Max-specific glue lives at
 * the very bottom, guarded by a feature check, so the scheduling core stays
 * pure and testable.
 */

/* global outlet, post, LiveAPI, jsarguments */
// Runs at top level (no wrapper): Max registers message handlers only when
// they are global function declarations, so `bang`/`sketch`/`chords`/`voice`
// live at the bottom as plain functions.

  var CHORD_VELOCITY = 80;
  var VOICE_VELOCITY = 100;
  var EPS = 1e-6;

  function defaultParts() {
    return { chords: true, v1: true, v2: false, v3: false, v4: false };
  }

  function Router() {
    this.events = [];          // flattened, part-tagged note events
    this.cycleBeats = 0;       // length the sketch repeats over
    this.parts = defaultParts();
    this.active = [];          // notes currently sounding: {note, offBeat}
    this.lastBeat = 0;
    this.wasPlaying = false;
  }

  /* Rebuild the event list from advice/sketch JSON coming off the sidecar.
   * Accepts either a parsed object or a JSON string. */
  Router.prototype.setSketch = function (data) {
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (e) { return; }
    }
    if (!data || typeof data !== "object") return;
    var chords = data.chords || [];
    var melody = data.melody || [];
    var events = [];
    var end = 0;
    var i, j;

    for (i = 0; i < chords.length; i++) {
      var chord = chords[i];
      var cStart = Number(chord.start) || 0;
      var cBeats = Number(chord.beats) || 0;
      var midi = chord.midi || [];
      end = Math.max(end, cStart + cBeats);
      for (j = 0; j < midi.length; j++) {
        events.push({
          part: "chords", note: (midi[j] | 0),
          start: cStart, dur: Math.max(0.02, cBeats * 0.98), vel: CHORD_VELOCITY,
        });
      }
    }
    for (i = 0; i < melody.length; i++) {
      var n = melody[i];
      var nStart = Number(n.start) || 0;
      var nDur = Number(n.duration) || 0;
      var voice = (Number(n.voice) || 1);
      if (voice < 1) voice = 1;
      if (voice > 4) voice = 4;
      end = Math.max(end, nStart + nDur);
      events.push({
        part: "v" + voice, note: (Number(n.pitch) | 0),
        start: nStart, dur: Math.max(0.02, nDur * 0.98), vel: VOICE_VELOCITY,
      });
    }

    this.events = events;
    // Repeat over whole bars so the loop stays musical even when the last note
    // ends mid-bar. Falls back to a single beat for an empty sketch.
    this.cycleBeats = end > 0 ? Math.max(1, Math.ceil(end)) : 0;
  };

  Router.prototype.setPart = function (name, on) {
    if (this.parts.hasOwnProperty(name)) this.parts[name] = !!on;
  };

  Router.prototype.isPartOn = function (name) {
    return !!this.parts[name];
  };

  /* Advance the player to absolute host beat `now`. `playing` and `now` come
   * from the Live transport. Emits MIDI via the injected sink:
   *   sink(status, note, velocity)  — status 144 note-on, 128 note-off. */
  Router.prototype.tick = function (now, playing, sink) {
    if (!playing) {
      if (this.wasPlaying) this.allNotesOff(sink);
      this.wasPlaying = false;
      return;
    }

    // Resync (release + re-sound what should be playing at `now`) only on
    // playback start or a backward jump (loop wrap / seek back). Forward motion
    // — even coarse, low-rate ticks — is handled by the occurrence loop below,
    // so a held note is never retriggered just because ticks arrive slowly.
    if (!this.wasPlaying || now < this.lastBeat - EPS) {
      this.allNotesOff(sink);
      this.startAt(now, sink);
      this.lastBeat = now;
      this.wasPlaying = true;
      return;
    }

    var from = this.lastBeat;
    var to = now;
    var cycle = this.cycleBeats;

    // Release notes whose end fell within this step.
    var stillActive = [];
    for (var a = 0; a < this.active.length; a++) {
      var act = this.active[a];
      if (act.offBeat <= to + EPS) sink(128, act.note, 0);
      else stillActive.push(act);
    }
    this.active = stillActive;

    if (cycle > 0) {
      for (var e = 0; e < this.events.length; e++) {
        var ev = this.events[e];
        if (!this.parts[ev.part]) continue;
        // First occurrence strictly after `from`.
        var occ = ev.start + Math.ceil((from - ev.start - EPS) / cycle) * cycle;
        while (occ <= to + EPS) {
          if (occ > from + EPS) {
            sink(144, ev.note, ev.vel);
            this.active.push({ note: ev.note, offBeat: occ + ev.dur });
          }
          occ += cycle;
        }
      }
    }

    this.lastBeat = to;
  };

  /* Emit note-ons for every enabled note that is sounding at beat `now`
   * (its most recent occurrence has started but not yet ended). */
  Router.prototype.startAt = function (now, sink) {
    var cycle = this.cycleBeats;
    if (cycle <= 0) return;
    for (var e = 0; e < this.events.length; e++) {
      var ev = this.events[e];
      if (!this.parts[ev.part]) continue;
      var k = Math.floor((now - ev.start) / cycle);
      if (k < 0) k = 0;
      var occ = ev.start + k * cycle;
      if (occ <= now + EPS && occ + ev.dur > now + EPS) {
        sink(144, ev.note, ev.vel);
        this.active.push({ note: ev.note, offBeat: occ + ev.dur });
      }
    }
  };

  Router.prototype.allNotesOff = function (sink) {
    for (var a = 0; a < this.active.length; a++) sink(128, this.active[a].note, 0);
    this.active = [];
  };

  // ── Exports for the Node test harness ─────────────────────────────────────
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { Router: Router, defaultParts: defaultParts };
  }

// ── Max [js] glue — top-level handlers so Max registers them ────────────────
// The patch bangs this from a [metro], sends `sketch <json>` from the HTTP
// fetch, and toggles parts with `chords 0/1` / `voice N 0/1`. In Node these are
// defined but never called (only Router is exercised by the test harness).
var g_router = new Router();
var g_live = null;
var g_bangCount = 0;
var g_sketchCount = 0;

// Logging is OFF by default: post() is slow in Max, and logging every note or
// tick throttles the js enough to smear MIDI timing. Flip HC_DEBUG to true only
// while diagnosing. Load and errors always log.
var HC_DEBUG = false;
function hcLog(msg) { if (typeof post !== "undefined") post("[HC] " + msg + "\n"); }
function hcDbg(msg) { if (HC_DEBUG) hcLog(msg); }

hcLog("router.js loaded");

function hcSink(status, note, vel) { outlet(0, status, note, vel); }

function bang() {
  if (typeof LiveAPI === "undefined") return;
  try {
    if (g_live === null) g_live = new LiveAPI(null, "live_set");
    var playing = Number(g_live.get("is_playing")) > 0;
    var beat = Number(g_live.get("current_song_time"));
    g_router.tick(beat, playing, hcSink);
  } catch (e) {
    hcLog("bang ERROR: " + e.message);
  }
}

function sketch(json) {
  g_router.setSketch(json);
  g_sketchCount++;
  hcDbg("sketch #" + g_sketchCount + " -> " + g_router.events.length + " events, cycle " + g_router.cycleBeats);
}

function chords(on) { g_router.setPart("chords", Number(on) > 0); hcLog("part chords=" + (Number(on) > 0)); }

function voice(n, on) { g_router.setPart("v" + (n | 0), Number(on) > 0); hcLog("part voice" + (n | 0) + "=" + (Number(on) > 0)); }

function stop() { if (typeof outlet !== "undefined") g_router.allNotesOff(hcSink); }

// The editor's Play/Stop, relayed by node.script: drive Ableton's transport so
// the app launches playback and every player follows the same host clock.
function transport(playing) {
  if (typeof LiveAPI === "undefined") return;
  try {
    if (g_live === null) g_live = new LiveAPI(null, "live_set");
    if (Number(playing) > 0) { g_live.call("start_playing"); hcLog("app -> START transport"); }
    else { g_live.call("stop_playing"); hcLog("app -> STOP transport"); }
  } catch (e) { hcLog("transport ERROR: " + e.message); }
}
