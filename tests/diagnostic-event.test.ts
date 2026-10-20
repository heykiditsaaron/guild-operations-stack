import assert from "node:assert/strict";
import { test } from "node:test";
import { emitDiagnosticEvent } from "../src/core/diagnostic-event.ts";
import type { PublishOperationalRecordInput } from "../src/operational-inspection.ts";

function event() {
  return {
    severity: "error" as const, source: "discord.gateway", operation: "interaction-delivery",
    kind: "exception" as const, summary: "Discord Gateway interaction dispatch failed",
    correlation: { interactionId: "12345" },
    runtimeError: new Error("provider raw diagnostic"),
    details: { failureCode: "discord_gateway_edit_400" },
  };
}

test("one event has the same identity and summary in runtime and persisted views", async () => {
  let logged: { context: Record<string, unknown>; message: string } | undefined;
  let persisted: PublishOperationalRecordInput | undefined;
  const log = {
    info: () => undefined, warn: () => undefined,
    error: (context: Record<string, unknown>, message: string) => { logged = { context, message }; },
  };
  const id = await emitDiagnosticEvent(event(), log as never, async (record) => { persisted = record; });
  assert.equal(logged?.context.eventId, id);
  assert.equal(persisted?.details?.eventId, id);
  assert.equal(logged?.message, persisted?.summary);
  assert.equal(persisted?.details?.interactionId, "12345");
  assert.equal(persisted?.details?.severity, "error");
  assert.equal(JSON.stringify(persisted).includes("provider raw diagnostic"), false);
});

test("database failure cannot reject diagnostic emission and runtime evidence remains", async () => {
  const messages: string[] = [];
  const log = { info: () => undefined, warn: () => undefined,
    error: (_context: unknown, message: string) => { messages.push(message); } };
  await assert.doesNotReject(emitDiagnosticEvent(event(), log as never, async () => {
    throw new Error("database unavailable");
  }));
  assert.deepEqual(messages, ["Discord Gateway interaction dispatch failed", "Diagnostic event persistence failed"]);
});

test("runtime sink failure does not prevent persistence or escape", async () => {
  let persisted = false;
  const log = { info: () => { throw Error("sink"); }, warn: () => { throw Error("sink"); },
    error: () => { throw Error("sink"); } };
  await assert.doesNotReject(emitDiagnosticEvent(event(), log as never, async () => { persisted = true; }));
  assert.equal(persisted, true);
});
