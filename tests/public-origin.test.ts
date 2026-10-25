import assert from "node:assert/strict";
import { test } from "node:test";
import { installationPublicOrigin, normalizeOrigin } from "../src/core/installation/public-origin.js";

test("public origin comes from host configuration", async () => {
  assert.equal(await installationPublicOrigin({ PUBLIC_ORIGIN: "https://guild.example.com" }), "https://guild.example.com");
});

test("public origin is absent when host has not configured it", async () => {
  assert.equal(await installationPublicOrigin({}), null);
});

test("ambiguous host origin sources are rejected", async () => {
  await assert.rejects(installationPublicOrigin({
    PUBLIC_ORIGIN: "https://guild.example.com",
    PUBLIC_ORIGIN_FILE: "/not-used",
  }), /only one/);
});

test("public origin must be a scheme and authority without path or credentials", () => {
  assert.throws(() => normalizeOrigin("javascript://guild.example.com"));
  assert.throws(() => normalizeOrigin("https://guild.example.com/setup"));
  assert.throws(() => normalizeOrigin("https://user:pass@guild.example.com"));
});
