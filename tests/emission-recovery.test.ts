import assert from "node:assert/strict";
import { test } from "node:test";
import { createEmissionRecoveryCycle } from "../src/emissions/recovery.ts";

function diagnostics() {
  const records: Array<{ fields: Record<string, unknown>; message: string }> = [];
  return {
    records,
    log: { error(fields: Record<string, unknown>, message: string) { records.push({ fields, message }); } },
  };
}

test("successful emission recovery pass completes without an error diagnostic", async () => {
  let calls = 0;
  const { log, records } = diagnostics();
  const recover = createEmissionRecoveryCycle(async () => { calls++; }, log);
  await recover();
  assert.equal(calls, 1);
  assert.deepEqual(records, []);
});

test("emission recovery skips overlapping passes and permits another after completion", async () => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const { log } = diagnostics();
  const recover = createEmissionRecoveryCycle(async () => {
    calls++;
    if (calls === 1) await gate;
  }, log);
  const first = recover();
  await recover();
  assert.equal(calls, 1, "a concurrent recovery tick must not start another pass");
  release();
  await first;
  await recover();
  assert.equal(calls, 2, "a later tick should run after completion");
});

test("failed recovery emits structured error and does not block the next retry", async () => {
  const failure = new Error("database unavailable");
  let calls = 0;
  const { log, records } = diagnostics();
  const recover = createEmissionRecoveryCycle(async () => {
    calls++;
    if (calls === 1) throw failure;
  }, log);
  await assert.doesNotReject(recover());
  assert.deepEqual(records, [{ fields: { err: failure }, message: "Emission recovery failed" }]);
  await recover();
  assert.equal(calls, 2);
  assert.equal(records.length, 1);
});
