import assert from "node:assert/strict";
import { test } from "node:test";
import { completeEmissionAttempt } from "../src/emissions/attempt-completion.ts";

const emission = { code: "raid.modified", subject: "raid-1" };
const trace = { publicationId: "publication-1", consumerId: "consumer-1", attemptCount: 1 };

function capture() {
  const records: Array<{ level: string; fields: Record<string, unknown>; message: string }> = [];
  return {
    records,
    log: {
      info(fields: Record<string, unknown>, message: string) { records.push({ level: "info", fields, message }); },
      error(fields: Record<string, unknown>, message: string) { records.push({ level: "error", fields, message }); },
    },
  };
}

test("successful consumer and acknowledgment emit an acknowledged outcome", async () => {
  const { log, records } = capture();
  let acknowledged = false;
  await completeEmissionAttempt(async () => {}, emission, async () => { acknowledged = true; }, log, trace);
  assert.equal(acknowledged, true);
  assert.deepEqual(records, [{ level: "info", fields: trace, message: "Emission consumer acknowledged" }]);
});

test("consumer failure leaves receipt pending and does not attempt acknowledgment", async () => {
  const { log, records } = capture();
  const failure = new Error("consumer unavailable");
  let acknowledged = false;
  await completeEmissionAttempt(async () => { throw failure; }, emission, async () => { acknowledged = true; }, log, trace);
  assert.equal(acknowledged, false);
  assert.deepEqual(records, [{ level: "error", fields: { err: failure, ...trace }, message: "Emission consumer failed; receipt remains pending" }]);
});

test("acknowledgment failure is not misreported as a consumer failure", async () => {
  const { log, records } = capture();
  const failure = new Error("database unavailable");
  let delivered = false;
  await completeEmissionAttempt(async () => { delivered = true; }, emission, async () => { throw failure; }, log, trace);
  assert.equal(delivered, true);
  assert.deepEqual(records, [{ level: "error", fields: { err: failure, ...trace }, message: "Emission acknowledgment persistence failed; receipt remains pending and consumer may have completed" }]);
});
