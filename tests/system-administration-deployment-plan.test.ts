import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initializeInstallationState } from "../src/system-administration/state.js";
import { writeDatabaseConfiguration } from "../src/system-administration/database-configuration.js";
import { createDeploymentPlan } from "../src/system-administration/deployment-plan.js";

test("deployment plan refuses incomplete installation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-plan-"));
  try {
    await assert.rejects(createDeploymentPlan("/srv/guild-operations", directory), /prerequisites incomplete/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("deployment plan selects database topology without exposing credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-plan-"));
  try {
    await initializeInstallationState(directory);
    await writeDatabaseConfiguration({
      schemaVersion: 1, mode: "bundled", database: "guild_operations",
      username: "guild_operations", password: "sensitive-test-password-123",
    }, directory);
    const bundled = await createDeploymentPlan("/srv/guild-operations", directory);
    assert.deepEqual(bundled.services, ["db", "migrate", "api", "discord"]);
    assert.equal(bundled.composeFiles[0], resolve("/srv/guild-operations/compose.yaml"));
    assert.ok(!JSON.stringify(bundled).includes("sensitive-test-password-123"));
    await writeDatabaseConfiguration({
      schemaVersion: 1, mode: "external",
      connectionUrl: "postgresql://user:private@postgres.example:5432/guild",
    }, directory);
    const external = await createDeploymentPlan("/srv/guild-operations", directory);
    assert.deepEqual(external.services, ["migrate", "api", "discord"]);
    assert.ok(!JSON.stringify(external).includes("private"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
