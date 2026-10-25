import assert from "node:assert/strict";
import { test } from "node:test";
import { chmod, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareRuntimeHandoff } from "../src/system-administration/runtime-handoff.js";
import { writeDatabaseConfiguration } from "../src/system-administration/database-configuration.js";

test("bundled handoff emits only scoped private runtime files", async () => {
  const root = await mkdtemp(join(tmpdir(), "go-handoff-"));
  const authority = join(root, "authority");
  const destination = join(root, "handoff");
  try {
    await writeDatabaseConfiguration({
      schemaVersion: 1, mode: "bundled", database: "guild_operations",
      username: "guild_operations", password: "a-private-test-password",
    }, authority);
    const result = await prepareRuntimeHandoff(destination, authority);
    assert.equal(result.mode, "bundled");
    assert.deepEqual(result.files.map((file) => file.split("/").at(-1)).sort(),
      ["database-connection.json", "postgres-password"]);
    for (const file of result.files) {
      assert.equal((await stat(file)).mode & 0o077, 0);
    }
    const projected = JSON.parse(await readFile(join(destination, "database-connection.json"), "utf8"));
    assert.deepEqual(Object.keys(projected).sort(), ["connectionUrl", "schemaVersion"]);
    assert.match(projected.connectionUrl, /guild_operations/);
    assert.equal(await readFile(join(destination, "postgres-password"), "utf8"), "a-private-test-password\n");
    await assert.rejects(prepareRuntimeHandoff(authority, authority), /separate/);
    await assert.rejects(prepareRuntimeHandoff(join(authority, "nested"), authority), /separate/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("external handoff does not emit bundled password", async () => {
  const root = await mkdtemp(join(tmpdir(), "go-handoff-ext-"));
  try {
    const authority = join(root, "authority");
    await writeDatabaseConfiguration({
      schemaVersion: 1, mode: "external",
      connectionUrl: "postgresql://user:password@db.example.test:5432/guild",
    }, authority);
    const result = await prepareRuntimeHandoff(join(root, "runtime"), authority);
    assert.equal(result.mode, "external");
    assert.equal(result.files.length, 1);
    assert.match(result.files[0], /database-connection\.json$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
