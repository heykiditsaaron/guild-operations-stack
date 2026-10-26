import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installationPublicOrigin, normalizeOrigin } from "../src/core/installation/public-origin.js";

test("public origin comes from host configuration", async () => {
  assert.equal(await installationPublicOrigin({ PUBLIC_ORIGIN: "https://guild.example.com" }), "https://guild.example.com");
});

test("public origin is absent when host has not configured it", async () => {
  assert.equal(await installationPublicOrigin({}), null);
});

test("origin file takes precedence and missing file fails closed", async () => {
  const directory = mkdtempSync(join(tmpdir(), "go-origin-"));
  try {
    const file = join(directory, "origin");
    writeFileSync(file, "https://file.example.com\n");
    assert.equal(await installationPublicOrigin({ PUBLIC_ORIGIN: "https://env.example.com", PUBLIC_ORIGIN_FILE: file }), "https://file.example.com");
    await assert.rejects(installationPublicOrigin({ PUBLIC_ORIGIN: "https://env.example.com", PUBLIC_ORIGIN_FILE: join(directory, "missing") }), /ENOENT/);
    writeFileSync(file, "");
    await assert.rejects(installationPublicOrigin({ PUBLIC_ORIGIN: "https://env.example.com", PUBLIC_ORIGIN_FILE: file }), /empty/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("public origin must be a scheme and authority without path or credentials", () => {
  assert.throws(() => normalizeOrigin("javascript://guild.example.com"));
  assert.throws(() => normalizeOrigin("https://guild.example.com/setup"));
  assert.throws(() => normalizeOrigin("https://user:pass@guild.example.com"));
});
