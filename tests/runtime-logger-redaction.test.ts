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
    accessToken: "access-secret",
    refreshToken: "refresh-secret",
    clientSecret: "client-secret",
    authorization: "authorization-secret",
    cookie: "cookie-secret",
    req: { headers: { authorization: "request-auth-secret", cookie: "request-cookie-secret" } },
    integration: { token: "nested-token-secret", accessToken: "nested-access-secret" },
    headers: { authorization: "Bearer secret", cookie: "session=secret" },
    config: { botToken: "sensitive-bot-token" },
    err: new Error("expected failure"),
  }, "Diagnostic context");
  const record = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  assert.equal(record.interactionId, "interaction-123");
  assert.equal(record.token, "[REDACTED]");
  for (const key of ["accessToken", "refreshToken", "clientSecret", "authorization", "cookie"]) {
    assert.equal(record[key], "[REDACTED]", key);
  }
  assert.deepEqual(record.req, { headers: { authorization: "[REDACTED]", cookie: "[REDACTED]" } });
  assert.deepEqual(record.integration, { token: "[REDACTED]", accessToken: "[REDACTED]" });
  assert.deepEqual(record.headers, { authorization: "[REDACTED]", cookie: "[REDACTED]" });
  assert.deepEqual(record.config, { botToken: "[REDACTED]" });
  assert.equal(record.msg, "Diagnostic context");
  assert.doesNotMatch(JSON.stringify(record), /sensitive-token|session=secret|sensitive-bot-token|access-secret|refresh-secret|client-secret|authorization-secret|cookie-secret|request-auth-secret|request-cookie-secret|nested-token-secret|nested-access-secret/);
});
