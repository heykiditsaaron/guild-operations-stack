import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { administrationStatus, initializeAdministration } from "../src/system-administration/operations.js";
import { createAdministrationServer } from "../src/system-administration/server.js";

test("administration initializes explicitly, persists identity and survives restarts without PostgreSQL", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-admin-"));
  try {
    assert.equal((await administrationStatus(directory)).initialized, false);
    const first = await initializeAdministration(directory);
    assert.equal(first.schemaVersion, 1);
    assert.deepEqual(await initializeAdministration(directory), first);
    assert.deepEqual((await administrationStatus(directory)).installation, first);
    assert.equal(JSON.parse(await readFile(join(directory, "installation-state.json"), "utf8")).installationId, first.installationId);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("invalid or unsupported state fails closed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-admin-"));
  try {
    await writeFile(join(directory, "installation-state.json"), '{"schemaVersion":99}');
    await assert.rejects(() => administrationStatus(directory), /Unsupported installation state version/);
    await assert.rejects(() => initializeAdministration(directory), /Unsupported installation state version/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("administration HTTP is independent and exposes no installation identifier", async () => {
  const app = createAdministrationServer();
  try {
    const health = await app.inject("/health");
    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.json(), { status: "ok" });
    const status = await app.inject("/status");
    assert.equal(status.statusCode, 200);
    assert.equal(typeof status.json().initialized, "boolean");
    assert.equal("installation" in status.json(), false);
  } finally { await app.close(); }
});
