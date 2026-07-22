import { createHash, randomUUID } from "node:crypto";
import { Ableton } from "ableton-js";

const stableNote = (note) => ({
  pitch: note.pitch,
  start: note.start_time,
  duration: note.duration,
  velocity: note.velocity,
  mute: Boolean(note.mute),
  probability: note.probability ?? 1,
  velocity_deviation: note.velocity_deviation ?? 0,
  release_velocity: note.release_velocity ?? 64,
});

const fingerprint = (clip, notes) => createHash("sha256")
  .update(JSON.stringify({
    name: clip.name,
    loop_start: clip.loop_start,
    loop_end: clip.loop_end,
    notes: notes.map(stableNote),
  }))
  .digest("hex");

async function main() {
  const ableton = new Ableton({
    logger: null,
    commandTimeoutMs: 12000,
    heartbeatInterval: 30000,
  });
  await ableton.start();

  try {
    const clip = await ableton.song.view.get("detail_clip");
    if (!clip) throw new Error("No clip is open in Live Detail View");

    const isAudio = await clip.get("is_audio_clip");
    if (isAudio) throw new Error("The Detail View clip is audio; select a MIDI clip");

    const [name, loopStart, loopEnd, signatureNumerator, signatureDenominator] = await Promise.all([
      clip.get("name"),
      clip.get("loop_start"),
      clip.get("loop_end"),
      clip.get("signature_numerator"),
      clip.get("signature_denominator"),
    ]);
    const rawNotes = await clip.getNotesExtended(0, 0, Number.MAX_SAFE_INTEGER, 128);
    const ordered = [...rawNotes].sort((a, b) =>
      a.start_time - b.start_time || a.pitch - b.pitch || a.note_id - b.note_id);

    const clipMeta = {
      runtime_id: clip.raw?.id ?? null,
      name,
      loop_start: loopStart,
      loop_end: loopEnd,
    };
    const payload = {
      protocol_version: "1.0",
      request_id: randomUUID(),
      project_id: randomUUID(),
      title: name || "Ableton MIDI Clip",
      meter: {
        numerator: signatureNumerator,
        denominator: signatureDenominator,
      },
      key: { tonic: "C", mode: "chromatic", source: "placeholder" },
      clip: {
        ...clipMeta,
        fingerprint: fingerprint(clipMeta, ordered),
      },
      chords: [],
      notes: ordered.map((note, index) => ({
        id: `note-${index + 1}`,
        live_note_id: note.note_id,
        ...stableNote(note),
      })),
    };

    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } finally {
    ableton.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
  process.exitCode = 1;
});
