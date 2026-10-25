import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeDatabaseConfiguration } from "../src/system-administration/database-configuration.js";
import { projectRuntimeDatabaseConfiguration } from "../src/system-administration/runtime-database-projection.js";

test("projects only connection details into a private runtime file", async () => {
  const root = await mkdtemp(join(tmpdir(), "go-projection-"));
  try {
    const admin = join(root, "admin");
    const runtime = join(root, "runtime");
    await writeDatabaseConfiguration({
      schemaVersion: 1,
      mode: "external",
      connectionUrl: "postgresql://user:secret@db.example/guild",
    }, admin);
    const path = await projectRuntimeDatabaseConfiguration(runtime, admin);
    const projected = JSON.parse(await readFile(path, "utf8"));
    assert.deepEqual(Object.keys(projected).sort(), ["connectionUrl", "schemaVersion"]);
    assert.equal(projected.connectionUrl, "postgresql://user:secret@db.example/guild");
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert.equal((await stat(runtime)).mode & 0o777, 0o700);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses projection without database configuration", async () => {
  const root = await mkdtemp(join(tmpdir(), "go-projection-"));
  try {
    await assert.rejects(
      projectRuntimeDatabaseConfiguration(join(root, "runtime"), root),
      /not configured/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
