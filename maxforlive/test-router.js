/* Node test harness for harmonycanvas_router.js scheduling core. */
"use strict";
var Router = require("./harmonycanvas_router.js").Router;

var SKETCH = {
  chords: [{ start: 0, beats: 4, midi: [60, 64, 67] }],
  melody: [
    { pitch: 72, start: 0, duration: 1, voice: 1 },
    { pitch: 74, start: 2, duration: 1, voice: 2 },
  ],
};

var failures = 0;
function check(name, cond) {
  console.log((cond ? "  PASS " : "  FAIL ") + name);
  if (!cond) failures++;
}

/* Drive the router from beat `a` to `b` in fixed steps; collect emissions. */
function play(router, a, b, step) {
  var log = [];
  var sink = function (status, note, vel) { log.push({ t: router.lastBeat, status: status, note: note, vel: vel }); };
  // Prime a "playing" run: first tick establishes start.
  for (var beat = a; beat <= b + 1e-9; beat += step) {
    // record 'now' with the emission by wrapping sink to capture current beat
    var now = beat;
    var cap = function (status, note, vel) { log.push({ t: now, status: status, note: note, vel: vel }); };
    router.tick(now, true, cap);
  }
  return log;
}

function ons(log, note) { return log.filter(function (e) { return e.status === 144 && e.note === note; }); }
function offs(log, note) { return log.filter(function (e) { return e.status === 128 && e.note === note; }); }
function anyOn(log, notes) { return log.some(function (e) { return e.status === 144 && notes.indexOf(e.note) >= 0; }); }

console.log("Scenario A — chords only, beats 0..8.4");
var rA = new Router();
rA.setSketch(SKETCH);
check("cycle == 4", rA.cycleBeats === 4);
rA.setPart("chords", true); rA.setPart("v1", false); rA.setPart("v2", false);
var logA = play(rA, 0, 8.4, 0.1);
check("chord 60 fires at start (~beat 0)", ons(logA, 60).length >= 1 && ons(logA, 60)[0].t < 0.05);
check("all three chord tones present", ons(logA, 60).length && ons(logA, 64).length && ons(logA, 67).length);
check("chord 60 re-triggers on the loop (>=2 note-ons over 2 cycles)", ons(logA, 60).length >= 2);
check("chord 60 gets note-offs", offs(logA, 60).length >= 1);
check("chord 60 off near 3.92", offs(logA, 60).some(function (e) { return Math.abs(e.t - 3.92) < 0.12; }));
check("NO voice notes leak (72,74 silent)", !anyOn(logA, [72, 74]));

console.log("Scenario B — voice 2 only");
var rB = new Router();
rB.setSketch(SKETCH);
rB.setPart("chords", false); rB.setPart("v1", false); rB.setPart("v2", true);
var logB = play(rB, 0, 8.4, 0.1);
check("voice2 note 74 fires ~beat 2", ons(logB, 74).some(function (e) { return Math.abs(e.t - 2) < 0.12; }));
check("voice2 74 re-triggers next cycle (~beat 6)", ons(logB, 74).some(function (e) { return Math.abs(e.t - 6) < 0.12; }));
check("voice2 74 off ~2.98", offs(logB, 74).some(function (e) { return Math.abs(e.t - 2.98) < 0.12; }));
check("NO chords / voice1 leak (60,64,67,72 silent)", !anyOn(logB, [60, 64, 67, 72]));

console.log("Scenario C — stop releases all active notes");
var rC = new Router();
rC.setSketch(SKETCH);
rC.setPart("chords", true);
play(rC, 0, 1.0, 0.1);            // notes sounding
var stopLog = [];
rC.tick(1.1, false, function (s, n, v) { stopLog.push({ status: s, note: n }); });
check("stop emits note-offs for sounding chord", stopLog.filter(function (e) { return e.status === 128; }).length >= 3);
check("router has no active notes after stop", rC.active.length === 0);

console.log("Scenario D — loop wrap re-triggers start notes");
var rD = new Router();
rD.setSketch(SKETCH);
rD.setPart("chords", true); rD.setPart("v1", true);
rD.tick(3.8, true, function () {});      // playing near end
rD.tick(3.9, true, function () {});
var wrapLog = [];
rD.tick(0.02, true, function (s, n, v) { wrapLog.push({ status: s, note: n }); }); // jump back to top
check("wrap re-fires chord tone 60", wrapLog.some(function (e) { return e.status === 144 && e.note === 60; }));
check("wrap re-fires voice1 note 72", wrapLog.some(function (e) { return e.status === 144 && e.note === 72; }));

console.log("");
console.log(failures === 0 ? "ALL PASS" : (failures + " FAILURES"));
process.exit(failures === 0 ? 0 : 1);
