import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deploymentReadiness } from "../src/system-administration/deployment-readiness.js";
import { initializeInstallationState } from "../src/system-administration/state.js";
import { writeDatabaseConfiguration } from "../src/system-administration/database-configuration.js";

test("deployment preflight requires both installation and database state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-deployment-preflight-"));
  try {
    assert.deepEqual(await deploymentReadiness(directory), {
      ready: false,
      reasons: ["System Administration is not initialized", "Database configuration is missing"],
    });
    await initializeInstallationState(directory);
    assert.deepEqual(await deploymentReadiness(directory), {
      ready: false, reasons: ["Database configuration is missing"],
    });
    await writeDatabaseConfiguration({
      schemaVersion: 1, mode: "external",
      connectionUrl: "postgresql://test:test@db.example.test:5432/test",
    }, directory);
    assert.deepEqual(await deploymentReadiness(directory), { ready: true, databaseMode: "external" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("deployment preflight rejects malformed database state rather than treating it as missing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-deployment-preflight-"));
  try {
    await initializeInstallationState(directory);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(directory, "database-configuration.json"), "{}");
    await assert.rejects(deploymentReadiness(directory), /version/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
