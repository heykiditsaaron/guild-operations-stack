import assert from "node:assert/strict";
import { test } from "node:test";
import { claimEmissionReceipt } from "../src/emissions/receipt-claim.ts";

test("receipt claim targets one unacknowledged receipt and enforces the 30-second gate", async () => {
  let capturedSql = "";
  let capturedValues: string[] = [];
  const count = await claimEmissionReceipt(async (sql, values) => {
    capturedSql = sql;
    capturedValues = values;
    return { rowCount: 1, rows: [{ attempt_count: 2 }] };
  }, "publication-a", "consumer-b");
  assert.equal(count, 2);
  assert.deepEqual(capturedValues, ["publication-a", "consumer-b"]);
  assert.match(capturedSql, /UPDATE emission_consumer_receipts/);
  assert.match(capturedSql, /acknowledged_at_unix IS NULL/);
  assert.match(capturedSql, /last_attempted_at_unix IS NULL/);
  assert.match(capturedSql, /last_attempted_at_unix <= extract\(epoch FROM now\(\)\)::bigint - 30/);
  assert.match(capturedSql, /attempt_count = attempt_count \+ 1/);
  assert.match(capturedSql, /RETURNING attempt_count/);
});

test("ineligible receipt is not delivered when claim updates no row", async () => {
  const count = await claimEmissionReceipt(async () => ({ rowCount: 0, rows: [] }), "publication-a", "consumer-b");
  assert.equal(count, null);
});

test("database claim errors propagate to recovery rather than pretending to claim", async () => {
  const failure = new Error("database unavailable");
  await assert.rejects(claimEmissionReceipt(async () => { throw failure; }, "publication-a", "consumer-b"), (error) => error === failure);
});
