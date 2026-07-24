/*
 * transport-sync.mjs — bridge the Harmony Canvas editor's Play/Stop to Ableton
 * Live's transport.
 *
 * Why this exists: inside a VST3, Ableton refuses plug-in transport control
 * (`AudioPlayHead::canControlTransport()` is false), so the editor's Play button
 * cannot start Live from the plug-in. The editor already POSTs its Play/Stop to
 * the sidecar's `/api/transport`; this process watches that state and drives the
 * Live transport through the AbletonJS remote script (which *can* call
 * `start_playing` / `stop_playing`). The reverse direction — Live's tempo, PPQ
 * and play state feeding the editor's playhead and "120 DAW" badge — already
 * flows through the plug-in's play head, so this bridge is one-directional.
 *
 * The sidecar auto-launches it (see sidecar/server.py); it can also be run by
 * hand:  node transport-sync.mjs
 * It is a long-lived daemon: it keeps retrying until Live's AbletonJS control
 * surface answers and reconnects if the connection drops, so start order and
 * Ableton restarts do not matter.
 */
import { Ableton } from "ableton-js";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]?.replace(/^--/, "");
  if (key) args.set(key, process.argv[i + 1]);
}

const SIDECAR_HOST = args.get("host") || process.env.HARMONY_CANVAS_HOST || "127.0.0.1";
const SIDECAR_PORT = Number(args.get("port") || process.env.HARMONY_CANVAS_PORT || 8787);
const POLL_MS = Math.max(40, Number(args.get("poll-ms") || 120));
const TRANSPORT_URL = `http://${SIDECAR_HOST}:${SIDECAR_PORT}/api/transport`;

const log = (msg) => process.stdout.write(`[transport-sync] ${msg}\n`);
const warn = (msg) => process.stderr.write(`[transport-sync] ${msg}\n`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let ableton = null;
let connected = false;

/* Connect to Live, retrying forever. Live's AbletonJS surface may not answer for
 * a few seconds after Ableton launches (and the sidecar starts with it), so a
 * failed attempt is expected, not fatal. */
async function connect() {
  for (;;) {
    ableton = new Ableton({ logger: null, commandTimeoutMs: 8000, heartbeatInterval: 15000 });
    ableton.on("disconnect", () => { connected = false; warn("Live disconnected; reconnecting"); });
    ableton.on("connect", () => { connected = true; });
    try {
      await ableton.start();
      connected = true;
      log("connected to Ableton Live");
      return;
    } catch (error) {
      warn(`waiting for Live / AbletonJS control surface: ${error.message}`);
      try { ableton.close(); } catch { /* nothing open yet */ }
      await sleep(2500);
    }
  }
}

/* Read the editor's last Play/Stop command from the sidecar. `seq` increases on
 * every POST, so we can tell a real button press from an unchanged poll. */
async function readTransport() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(TRANSPORT_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const state = await response.json();
    return { playing: !!state.playing, seq: Number(state.seq) || 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  log(`watching ${TRANSPORT_URL} every ${POLL_MS} ms`);
  await connect();

  let lastSeq = null;   // null until the first read (baseline)
  let sidecarUp = true;
  let applying = false; // guard against overlapping Live calls on slow ticks

  const tick = async () => {
    if (!applying) {
      applying = true;
      try {
        const { playing, seq } = await readTransport();
        if (!sidecarUp) { log("sidecar back online"); sidecarUp = true; }

        // First read is a baseline. Only auto-start if the editor already asked
        // to play before this bridge came up; never auto-stop on startup.
        const changed = lastSeq === null ? playing : seq !== lastSeq;
        if (changed && connected) {
          if (playing) { await ableton.song.startPlaying(); log("editor Play  -> Live start_playing"); }
          else { await ableton.song.stopPlaying(); log("editor Stop  -> Live stop_playing"); }
        }
        lastSeq = seq;
      } catch (error) {
        if (sidecarUp) { warn(`sidecar unreachable (${error.message}); retrying`); sidecarUp = false; }
      } finally {
        applying = false;
      }
    }
    timer = setTimeout(tick, POLL_MS);
  };

  let timer = setTimeout(tick, 0);

  const shutdown = () => {
    clearTimeout(timer);
    try { ableton?.close(); } catch { /* already closing */ }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  warn(`fatal: ${error.message}`);
  process.exitCode = 1;
});
