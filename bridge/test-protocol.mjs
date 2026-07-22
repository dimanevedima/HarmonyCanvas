import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const parseJson = (text) => JSON.parse(text.replace(/^\uFEFF/, ""));
const readJson = (relativePath) => parseJson(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
const schema = readJson("../protocol/harmony-project.schema.json");
const validate = new Ajv2020({ allErrors: true, allowUnionTypes: true }).compile(schema);

const assertContract = (payload, label) => {
  assert.equal(validate(payload), true, `${label}: ${JSON.stringify(validate.errors)}`);
  const ordered = [...payload.notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  assert.deepEqual(payload.notes, ordered, `${label}: notes must be ordered by start and pitch`);
};

test("the four-chord fixture follows protocol 1.0", () => {
  assertContract(readJson("../tests/fixtures/four-chords.json"), "fixture");
});

test("the latest real Pull follows protocol 1.0 when present", (context) => {
  const captureUrl = new URL("../tests/captures/latest-pull.json", import.meta.url);
  if (!existsSync(fileURLToPath(captureUrl))) {
    context.skip("no local Ableton capture");
    return;
  }
  const payload = parseJson(readFileSync(captureUrl, "utf8"));
  assertContract(payload, "capture");
  assert.ok(payload.clip?.runtime_id, "capture: Live runtime ID is required");
  assert.match(payload.clip.fingerprint, /^[a-f0-9]{64}$/);
});
