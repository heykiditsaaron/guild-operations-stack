import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeInstallationState } from "../src/system-administration/state.js";
import { writeDatabaseConfiguration } from "../src/system-administration/database-configuration.js";
import { prepareLifecycleInvocation } from "../src/system-administration/compose-invocation.js";

test("bundled deployment preparation blocks an existing or unverifiable Docker volume", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-executor-guard-"));
  try {
    await initializeInstallationState(directory);
    await writeDatabaseConfiguration({
      schemaVersion: 1, mode: "bundled", database: "guild_operations",
      username: "guild_operations", password: "a-valid-test-password",
    }, directory);
    const request = { schemaVersion: 1, action: "apply" };
    const paths = {
      databaseConnectionFile: "/run/go/database-connection.json",
      bundledPasswordFile: "/run/go/postgres-password",
      bundledDatabase: "guild_operations", bundledUsername: "guild_operations",
    };
    await assert.rejects(
      prepareLifecycleInvocation(request, "/srv/go", directory, paths, async () => ({
        stdout: JSON.stringify({
          Name: "guild-operations_guild-operations-db", Driver: "local", Mountpoint: "/var/lib/docker/volumes/db/_data",
        }),
      })),
      /could not be verified/,
    );
    const invocation = await prepareLifecycleInvocation(request, "/srv/go", directory, paths, async () => {
      throw { code: 1, stderr: "Error response from daemon: No such volume: guild-operations_guild-operations-db" };
    });
    assert.equal(invocation.executable, "docker");
    assert.ok(invocation.arguments.includes("compose.bundled.yaml") === false);
    assert.ok(invocation.arguments.includes("/srv/go/compose.bundled.yaml"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("external database preparation never inspects the bundled Docker volume", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-executor-external-"));
  try {
    await initializeInstallationState(directory);
    await writeDatabaseConfiguration({
      schemaVersion: 1, mode: "external",
      connectionUrl: "postgresql://go:secret@db.example.test:5432/guild_operations",
    }, directory);
    const invocation = await prepareLifecycleInvocation(
      { schemaVersion: 1, action: "start" }, "/srv/go", directory,
      { databaseConnectionFile: "/run/go/database-connection.json" },
      async () => { throw new Error("Bundled volume inspection must not run"); },
    );
    assert.ok(invocation.arguments.includes("/srv/go/compose.external.yaml"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
