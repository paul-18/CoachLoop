import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseFitlog } from "../app/interchange/fitlog";

const corpus = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/fitlog/cases.v1.json", import.meta.url)), "utf8"));

test("synthetic FITLOG corpus covers prose, flattened commands and malformed outputs", () => {
  for (const sample of corpus.cases) {
    if (sample.valid) {
      assert.doesNotThrow(() => parseFitlog(sample.text, "lb", {}), sample.name);
      continue;
    }
    assert.throws(() => parseFitlog(sample.text, "lb", {}), new RegExp(sample.error), sample.name);
  }
});
