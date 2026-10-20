import assert from "node:assert/strict";
import { test } from "node:test";
import { PassThrough } from "node:stream";
import pino from "pino";
import { runtimeLoggerOptions } from "../src/core/runtime-logger.ts";

test("runtime logger redacts credential fields without losing diagnostic context", async () => {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));
  const isolated = pino(runtimeLoggerOptions, stream);
  isolated.info({
    interactionId: "interaction-123",
    token: "sensitive-token",
    headers: { authorization: "Bearer secret", cookie: "session=secret" },
    config: { botToken: "sensitive-bot-token" },
    err: new Error("expected failure"),
  }, "Diagnostic context");
  const record = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  assert.equal(record.interactionId, "interaction-123");
  assert.equal(record.token, "[REDACTED]");
  assert.deepEqual(record.headers, { authorization: "[REDACTED]", cookie: "[REDACTED]" });
  assert.deepEqual(record.config, { botToken: "[REDACTED]" });
  assert.equal(record.msg, "Diagnostic context");
  assert.doesNotMatch(JSON.stringify(record), /sensitive-token|session=secret|sensitive-bot-token/);
});
