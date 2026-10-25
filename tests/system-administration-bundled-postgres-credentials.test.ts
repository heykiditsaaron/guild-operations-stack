import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDatabaseConfiguration, writeDatabaseConfiguration } from "../src/system-administration/database-configuration.js";
import { configureNewBundledPostgres, projectBundledPostgresPassword } from "../src/system-administration/bundled-postgres-credentials.js";

test("new bundled credentials are random and never implicitly replaced", async () => {
  const root = await mkdtemp(join(tmpdir(), "go-bundled-"));
  try {
    await configureNewBundledPostgres(root);
    const config = await readDatabaseConfiguration(root);
    assert.equal(config?.mode, "bundled");
    if (!config || config.mode !== "bundled") throw new Error("Missing bundled config");
    assert.match(config.password, /^[a-f0-9]{64}$/);
    await assert.rejects(configureNewBundledPostgres(root), /already configured/);
    assert.deepEqual(await readDatabaseConfiguration(root), config);
    const projected = await projectBundledPostgresPassword(join(root, "runtime"), root);
    assert.equal(await readFile(projected, "utf8"), config.password + "\n");
    assert.equal((await stat(projected)).mode & 0o777, 0o600);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("external PostgreSQL credentials cannot be projected as bundled password", async () => {
  const root = await mkdtemp(join(tmpdir(), "go-external-"));
  try {
    await writeDatabaseConfiguration({ schemaVersion: 1, mode: "external", connectionUrl: "postgresql://user:password@db.example/guild" }, root);
    await assert.rejects(projectBundledPostgresPassword(join(root, "runtime"), root), /Bundled PostgreSQL/);
    await assert.rejects(configureNewBundledPostgres(root), /already configured/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
