import assert from "node:assert/strict";
import { test } from "node:test";
import { observeDiscordFallback } from "../src/integrations/discord/fallback-diagnostics.ts";

function captureWarnings() {
  const warnings: Array<{ fields: Record<string, unknown>; message: string }> = [];
  return {
    warnings,
    log: { warn(fields: Record<string, unknown>, message: string) { warnings.push({ fields, message }); } },
  };
}

const context = { interactionId: "interaction-123", interactionKind: "go:raffle:character" };

test("successful fallback delivery emits no warning", async () => {
  const { log, warnings } = captureWarnings();
  await observeDiscordFallback(Promise.resolve({ ok: true, status: 200 }), log, context, "rejected", "transport failed");
  assert.equal(warnings.length, 0);
});

test("non-success fallback response logs status and safe interaction coordinates", async () => {
  const { log, warnings } = captureWarnings();
  await observeDiscordFallback(Promise.resolve({ ok: false, status: 429 }), log, context, "rejected", "transport failed");
  assert.deepEqual(warnings, [{ fields: { ...context, status: 429 }, message: "rejected" }]);
});

test("fallback transport rejection logs serialized error coordinate without propagating", async () => {
  const { log, warnings } = captureWarnings();
  const failure = new Error("network unavailable");
  await assert.doesNotReject(observeDiscordFallback(Promise.reject(failure), log, context, "rejected", "transport failed"));
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].message, "transport failed");
  assert.equal(warnings[0].fields.err, failure);
  assert.equal(warnings[0].fields.interactionId, context.interactionId);
});
