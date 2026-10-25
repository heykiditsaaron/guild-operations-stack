import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeInstallationState } from "../src/system-administration/state.js";
import { writeDatabaseConfiguration } from "../src/system-administration/database-configuration.js";
import { executeProjectedHostLifecycle } from "../src/system-administration/projected-host-lifecycle.js";
import type { ComposeInvocation } from "../src/system-administration/compose-invocation.js";

test("projected host lifecycle derives external paths without bundled secrets", async () => {
  const root = await mkdtemp(join(tmpdir(), "go-host-handoff-"));
  try {
    const authority = join(root, "authority");
    const handoff = join(root, "handoff");
    await initializeInstallationState(authority);
    await writeDatabaseConfiguration({
      schemaVersion: 1, mode: "external",
      connectionUrl: "postgresql://user:password@db.example.test:5432/guild",
    }, authority);
    let calls = 0;
    await executeProjectedHostLifecycle(
      { schemaVersion: 1, action: "apply" }, "/srv/go", authority, handoff,
      async () => { throw new Error("external mode must not inspect bundled volume"); },
      async (invocation: ComposeInvocation) => {
        calls++;
        assert.equal(invocation.environment.GO_RUNTIME_DATABASE_CONFIG_FILE,
          join(handoff, "database-connection.json"));
        assert.equal(invocation.environment.GO_BUNDLED_POSTGRES_PASSWORD_FILE, undefined);
        assert.ok(invocation.arguments.includes("/srv/go/compose.external.yaml"));
      },
    );
    assert.equal(calls, 1);
    await assert.rejects(
      executeProjectedHostLifecycle({ schemaVersion: 1, action: "apply" }, "/srv/go", authority,
        join(authority, "nested"), async () => { throw new Error("unexpected"); },
        async () => { throw new Error("unexpected"); }),
      /separate from Administration state/,
    );
    await assert.rejects(
      executeProjectedHostLifecycle({ schemaVersion: 1, action: "apply" }, "/srv/go", authority,
        "relative/handoff", async () => { throw new Error("unexpected"); },
        async () => { throw new Error("unexpected"); }),
      /absolute canonical path/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("projected host lifecycle derives bundled identity from Administration", async () => {
  const root = await mkdtemp(join(tmpdir(), "go-host-bundled-"));
  try {
    const authority = join(root, "authority");
    const handoff = join(root, "handoff");
    await initializeInstallationState(authority);
    await writeDatabaseConfiguration({
      schemaVersion: 1, mode: "bundled", database: "guild_operations",
      username: "guild_operations", password: "private-test-password-long",
    }, authority);
    await executeProjectedHostLifecycle(
      { schemaVersion: 1, action: "apply" }, "/srv/go", authority, handoff,
      async () => { throw { code: 1, stderr: "No such volume: guild-operations_guild-operations-db" }; },
      async (invocation) => {
        assert.equal(invocation.environment.GO_BUNDLED_POSTGRES_DATABASE, "guild_operations");
        assert.equal(invocation.environment.GO_BUNDLED_POSTGRES_USERNAME, "guild_operations");
        assert.equal(invocation.environment.GO_BUNDLED_POSTGRES_PASSWORD_FILE,
          join(handoff, "postgres-password"));
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
