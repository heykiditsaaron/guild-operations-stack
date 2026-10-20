import assert from "node:assert/strict";
import { test } from "node:test";
import { PassThrough } from "node:stream";
import pino from "pino";
import { runtimeLoggerOptions } from "../src/core/runtime-logger.ts";

function capturedLogger(level: "info" | "debug" = "info") {
  const stream = new PassThrough();
  const records: Array<Record<string, unknown>> = [];
  stream.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString("utf8").trim().split("\n")) {
      if (line) records.push(JSON.parse(line) as Record<string, unknown>);
    }
  });
  return { log: pino({ ...runtimeLoggerOptions, level }, stream), records };
}

test("runtime logger preserves severity, component context, and serialized errors", () => {
  const { log, records } = capturedLogger();
  const component = log.child({ component: "test.worker" });
  component.debug({ attemptCount: 1 }, "Verbose attempt");
  component.warn({ attemptCount: 2 }, "Retry scheduled");
  component.error({ err: new Error("provider unavailable"), attemptCount: 3 }, "Delivery failed");

  assert.equal(records.length, 2, "debug diagnostics should be suppressed at info level");
  assert.equal(records[0].level, 40);
  assert.equal(records[0].component, "test.worker");
  assert.equal(records[0].attemptCount, 2);
  assert.equal(records[1].level, 50);
  assert.equal(records[1].component, "test.worker");
  const error = records[1].err as Record<string, unknown>;
  assert.match(String(error.message), /provider unavailable/);
  assert.match(String(error.stack), /provider unavailable/);
  assert.equal(records[1].service, "guild-operations");
  assert.equal(typeof records[1].time, "string");
});

test("debug verbosity emits technical diagnostics without disabling redaction", () => {
  const { log, records } = capturedLogger("debug");
  log.debug({ token: "debug-secret", context: { refreshToken: "nested-secret" } }, "Verbose diagnostic");

  assert.equal(records.length, 1);
  assert.equal(records[0].level, 20);
  assert.equal(records[0].token, "[REDACTED]");
  assert.deepEqual(records[0].context, { refreshToken: "[REDACTED]" });
  assert.doesNotMatch(JSON.stringify(records[0]), /debug-secret|nested-secret/);
});
