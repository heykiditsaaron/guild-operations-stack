import assert from "node:assert/strict";
import { test } from "node:test";
import type { FastifyRequest } from "fastify";
import { publicOriginForRequest } from "../src/core/installation/public-origin.js";

function request(headers: Record<string, string>, protocol = "http"): FastifyRequest {
  return { headers, protocol } as unknown as FastifyRequest;
}

test("setup discovers direct origin without deployment environment configuration", () => {
  assert.equal(publicOriginForRequest(request({ host: "localhost:3100" })), "http://localhost:3100");
});

test("setup discovers HTTPS origin behind a reverse proxy", () => {
  assert.equal(publicOriginForRequest(request({
    host: "api:3100",
    "x-forwarded-host": "guild.example.com",
    "x-forwarded-proto": "https",
  })), "https://guild.example.com");
});

test("ambiguous forwarded origin chains are rejected", () => {
  assert.throws(() => publicOriginForRequest(request({
    host: "api:3100",
    "x-forwarded-host": "guild.example.com, attacker.example",
    "x-forwarded-proto": "https",
  })));
});

test("invalid forwarded protocol is rejected", () => {
  assert.throws(() => publicOriginForRequest(request({
    host: "api:3100",
    "x-forwarded-host": "guild.example.com",
    "x-forwarded-proto": "javascript",
  })));
});
