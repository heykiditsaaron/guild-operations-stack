import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeInstallationState } from "../src/system-administration/state.js";
import { writeDatabaseConfiguration } from "../src/system-administration/database-configuration.js";
import { executeHostLifecycle } from "../src/system-administration/host-lifecycle-executor.js";
import type { ComposeInvocation } from "../src/system-administration/compose-invocation.js";

test("host executor only invokes runner after successful lifecycle preparation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-host-executor-"));
  try {
    await initializeInstallationState(directory);
    await writeDatabaseConfiguration({
      schemaVersion: 1, mode: "bundled", database: "guild_operations",
      username: "guild_operations", password: "test-password-long-enough",
    }, directory);
    const projection = {
      databaseConnectionFile: "/run/go/database-connection.json",
      bundledPasswordFile: "/run/go/postgres-password",
      bundledDatabase: "guild_operations", bundledUsername: "guild_operations",
    };
    let calls = 0;
    const runner = async (invocation: ComposeInvocation) => {
      calls++;
      assert.equal(invocation.executable, "docker");
      assert.ok(invocation.arguments.includes("/srv/go/compose.bundled.yaml"));
    };
    await assert.rejects(
      executeHostLifecycle({ schemaVersion: 1, action: "apply" }, "/srv/go", directory,
        projection, async () => ({ stdout: JSON.stringify({
          Name: "guild-operations_guild-operations-db", Driver: "local", Mountpoint: "/var/lib/docker/volumes/db/_data",
        }) }), runner),
      /could not be verified/,
    );
    assert.equal(calls, 0);
    await executeHostLifecycle({ schemaVersion: 1, action: "apply" }, "/srv/go", directory,
      projection, async () => { throw { code: 1, stderr: "No such volume: guild-operations_guild-operations-db" }; }, runner);
    assert.equal(calls, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("host executor never runs Docker on invalid lifecycle request", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-host-invalid-"));
  try {
    await assert.rejects(
      executeHostLifecycle({ schemaVersion: 1, action: "delete" }, "/srv/go", directory,
        { databaseConnectionFile: "/run/go/database-connection.json" },
        async () => { throw new Error("inspect must not run"); },
        async () => { throw new Error("runner must not run"); }),
      /Unsupported lifecycle action/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
