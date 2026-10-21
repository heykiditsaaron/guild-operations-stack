import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { FastifyRequest } from "fastify";
import { publicOriginForRequest } from "../src/core/installation/public-origin.js";

const previous = process.env.PUBLIC_ORIGIN;
afterEach(() => {
  if (previous === undefined) delete process.env.PUBLIC_ORIGIN;
  else process.env.PUBLIC_ORIGIN = previous;
});

function request(headers: Record<string, string>, protocol = "http"): FastifyRequest {
  return { headers, protocol } as unknown as FastifyRequest;
}

test("untrusted forwarded host and protocol cannot establish public origin", () => {
  delete process.env.PUBLIC_ORIGIN;
  assert.equal(publicOriginForRequest(request({
    host: "localhost:3100",
    "x-forwarded-host": "attacker.example",
    "x-forwarded-proto": "https",
  })), "http://localhost:3100");
});

test("explicit public origin supports a TLS-terminating reverse proxy", () => {
  process.env.PUBLIC_ORIGIN = "https://guild.example.com";
  assert.equal(publicOriginForRequest(request({ host: "localhost:3100", "x-forwarded-host": "attacker.example" })), "https://guild.example.com");
});

test("invalid configured origins fail closed", () => {
  process.env.PUBLIC_ORIGIN = "https://guild.example.com/evil";
  assert.throws(() => publicOriginForRequest(request({ host: "localhost:3100" })));
});
