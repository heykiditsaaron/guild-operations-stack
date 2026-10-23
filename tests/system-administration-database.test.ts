import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDatabaseConfiguration, writeDatabaseConfiguration, publicDatabaseConfiguration, validateDatabaseConfiguration } from "../src/system-administration/database-configuration.js";
import { establishAdministratorCredential } from "../src/system-administration/authorization.js";
import { createAdministrationServer } from "../src/system-administration/server.js";

test("database configuration persists without PostgreSQL and never exposes credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-db-config-"));
  try {
    assert.equal(await readDatabaseConfiguration(directory), null);
    const value = { schemaVersion: 1, mode: "external", connectionUrl: "postgresql://operator:private-secret@database.example:5432/guild" };
    await writeDatabaseConfiguration(value, directory);
    assert.deepEqual(await readDatabaseConfiguration(directory), value);
    assert.deepEqual(publicDatabaseConfiguration(await readDatabaseConfiguration(directory)), { configured: true, mode: "external" });
    const disk = await readFile(join(directory, "database-configuration.json"), "utf8");
    assert.ok(disk.includes("private-secret"));
    await assert.rejects(() => writeDatabaseConfiguration({ schemaVersion: 1, mode: "external", connectionUrl: "https://example.org/" }, directory), /PostgreSQL/);
    assert.deepEqual(await readDatabaseConfiguration(directory), value);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("bundled database requires explicit strong password and rejects unknown fields", () => {
  assert.deepEqual(validateDatabaseConfiguration({ schemaVersion: 1, mode: "bundled", database: "guild_operations", username: "guild_operations", password: "a".repeat(32) }).mode, "bundled");
  assert.throws(() => validateDatabaseConfiguration({ schemaVersion: 1, mode: "bundled", database: "guild_operations", username: "guild_operations", password: "weak" }), /credentials/);
  assert.throws(() => validateDatabaseConfiguration({ schemaVersion: 1, mode: "external", connectionUrl: "postgres://u:p@host/db", unexpected: true }), /fields/);
});

test("administration database status is session protected and redacted", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-db-config-"));
  const app = createAdministrationServer(directory);
  try {
    await writeDatabaseConfiguration({ schemaVersion: 1, mode: "external", connectionUrl: "postgres://operator:secret@host/db" }, directory);
    assert.equal((await app.inject("/administration/database")).statusCode, 401);
    const token = await establishAdministratorCredential(directory);
    const login = await app.inject({ method: "POST", url: "/administration/session", headers: { authorization: `Bearer ${token}` } });
    const cookie = String(login.headers["set-cookie"]).split(";")[0];
    const response = await app.inject({ url: "/administration/database", headers: { cookie } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { configured: true, mode: "external" });
    assert.equal(response.body.includes("secret"), false);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});
