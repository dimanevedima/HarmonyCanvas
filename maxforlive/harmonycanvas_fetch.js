/*
 * harmonycanvas_fetch.js — HTTP side of the "Harmony Canvas Player" device.
 *
 * Runs inside a Max [node.script] object. Polls the local Harmony Canvas
 * sidecar, resolves which sketch to play, pulls its advice (chords + melody),
 * and forwards a compact payload to the patch as `sketch <json>` — which the
 * [js harmonycanvas_router.js] object turns into transport-synced MIDI.
 *
 * The HTTP/transform core is exported so it can be exercised under plain Node
 * against a running sidecar; the max-api glue only activates inside Max.
 */
"use strict";

var http = require("http");

var DEFAULT_HOST = "127.0.0.1";
var DEFAULT_PORT = 8787;

function getJson(host, port, path, cb) {
  var req = http.get({ host: host, port: port, path: path, timeout: 2500 }, function (res) {
    var body = "";
    res.on("data", function (chunk) { body += chunk; });
    res.on("end", function () {
      if (res.statusCode < 200 || res.statusCode >= 300) { cb(new Error("HTTP " + res.statusCode)); return; }
      try { cb(null, JSON.parse(body)); } catch (e) { cb(e); }
    });
  });
  req.on("error", function (e) { cb(e); });
  req.on("timeout", function () { req.destroy(new Error("timeout")); });
}

/* Keep only the fields the router needs, so the message stays small. */
function compactAdvice(advice) {
  var chords = (advice.chords || []).map(function (c) {
    return { start: c.start, beats: c.beats, midi: c.midi || [] };
  });
  var melody = (advice.melody || []).map(function (n) {
    return { pitch: n.pitch, start: n.start, duration: n.duration, voice: n.voice || 1 };
  });
  return { chords: chords, melody: melody };
}

/* Resolve the sketch to play, then fetch its advice.
 * `selected` — a sketch id to pin, or falsy to follow the most recently edited
 * sketch across all instances. cb(err, { id, updated_at, payload }). */
function fetchSketch(host, port, selected, cb) {
  getJson(host, port, "/api/sketches?all=1", function (err, list) {
    if (err) { cb(err); return; }
    if (!list || !list.length) { cb(new Error("no sketches")); return; }
    var pick = null;
    if (selected) {
      for (var i = 0; i < list.length; i++) if (list[i].id === selected) { pick = list[i]; break; }
    }
    if (!pick) {
      pick = list.reduce(function (a, b) {
        return (String(b.updated_at) > String(a.updated_at)) ? b : a;
      });
    }
    getJson(host, port, "/api/sketches/" + encodeURIComponent(pick.id) + "/advice", function (aErr, advice) {
      if (aErr) { cb(aErr); return; }
      cb(null, { id: pick.id, updated_at: pick.updated_at, payload: compactAdvice(advice) });
    });
  });
}

/* Fetch the editor's transport command (play/stop) the app posted. */
function fetchTransport(host, port, cb) {
  getJson(host, port, "/api/transport", function (err, t) {
    if (err) { cb(err); return; }
    cb(null, { playing: !!t.playing, position: Number(t.position) || 0, seq: t.seq | 0 });
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getJson: getJson, compactAdvice: compactAdvice, fetchSketch: fetchSketch, fetchTransport: fetchTransport };
}

// ── Max [node.script] glue ──────────────────────────────────────────────────
// Activates only inside Max. Patch usage:
//   loadbang → this node.script; a [metro 1000] → `poll`; `host`/`port`/`select`
//   messages configure it. It answers with `sketch <json>` and `status <text>`.
(function () {
  var Max;
  try { Max = require("max-api"); } catch (e) { return; }

  var host = DEFAULT_HOST, port = DEFAULT_PORT, selected = null, lastKey = "", lastTransportSeq = -1;

  function poll() {
    fetchSketch(host, port, selected, function (err, res) {
      if (err) { Max.outlet("status", "offline: " + err.message); return; }
      var key = res.id + "@" + res.updated_at;
      if (key !== lastKey) {               // unchanged since last poll
        lastKey = key;
        Max.outlet("sketch", JSON.stringify(res.payload));
        Max.outlet("status", "ok: " + res.id.slice(0, 8));
      }
    });
    // Transport command from the editor: emit only on a real change.
    fetchTransport(host, port, function (err, t) {
      if (err) return;
      if (t.seq === lastTransportSeq) return;
      lastTransportSeq = t.seq;
      Max.outlet("transport", t.playing ? 1 : 0);
    });
  }

  Max.addHandler("poll", poll);
  Max.addHandler("host", function (h) { host = String(h); lastKey = ""; });
  Max.addHandler("port", function (p) { port = (p | 0) || DEFAULT_PORT; lastKey = ""; });
  Max.addHandler("select", function (id) { selected = id ? String(id) : null; lastKey = ""; });
  Max.addHandler("auto", function () { selected = null; lastKey = ""; });
})();
