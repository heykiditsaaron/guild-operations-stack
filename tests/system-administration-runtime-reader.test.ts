import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runtimeDatabaseConnectionString } from "../src/system-administration/database-runtime.js";

test("managed runtime consumes projected connection without Administration state", async () => {
  const root = await mkdtemp(join(tmpdir(), "go-runtime-reader-"));
  const previous = process.env.GUILD_OPERATIONS_DATABASE_CONFIG_FILE;
  try {
    const path = join(root, "database-connection.json");
    await writeFile(path, JSON.stringify({ schemaVersion: 1, connectionUrl: "postgresql://user:secret@external.example/guild" }));
    process.env.GUILD_OPERATIONS_DATABASE_CONFIG_FILE = path;
    assert.equal(runtimeDatabaseConnectionString(join(root, "missing-admin")), "postgresql://user:secret@external.example/guild");
    await writeFile(path, JSON.stringify({ schemaVersion: 1, connectionUrl: "postgresql://user:secret@external.example/guild", extra: true }));
    assert.throws(() => runtimeDatabaseConnectionString(join(root, "missing-admin")), /Invalid database runtime projection/);
    await writeFile(path, JSON.stringify({ schemaVersion: 1, connectionUrl: "https://not-postgres.example/guild" }));
    assert.throws(() => runtimeDatabaseConnectionString(join(root, "missing-admin")), /Invalid database runtime projection/);
  } finally {
    if (previous === undefined) delete process.env.GUILD_OPERATIONS_DATABASE_CONFIG_FILE;
    else process.env.GUILD_OPERATIONS_DATABASE_CONFIG_FILE = previous;
    await rm(root, { recursive: true, force: true });
  }
});
