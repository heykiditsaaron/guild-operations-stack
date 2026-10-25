import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { databaseConnectionString, runtimeDatabaseConnectionString } from "../src/system-administration/database-runtime.js";

test("runtime refuses to start with missing or malformed Administration database state", () => {
  const directory = mkdtempSync(join(tmpdir(), "go-runtime-db-"));
  try {
    assert.throws(() => runtimeDatabaseConnectionString(directory), /not configured/);
    writeFileSync(join(directory, "database-configuration.json"), '{"schemaVersion":1,"mode":"external","connectionUrl":"http://bad"}');
    assert.throws(() => runtimeDatabaseConnectionString(directory), /PostgreSQL/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("bundled and external runtime database connection semantics", () => {
  assert.equal(databaseConnectionString({ schemaVersion: 1, mode: "bundled", database: "guild_operations", username: "operator", password: "special:@/password!123" }), "postgresql://operator:special%3A%40%2Fpassword!123@db:5432/guild_operations");
  const url = "postgresql://operator:password@postgres.example:5432/guild";
  assert.equal(databaseConnectionString({ schemaVersion: 1, mode: "external", connectionUrl: url }), url);
});

test("host DATABASE_URL overrides legacy Administration state", () => {
  const previous = process.env.DATABASE_URL;
  try {
    process.env.DATABASE_URL = "postgresql://operator:password@postgres.example:5432/guild";
    assert.equal(runtimeDatabaseConnectionString("/missing-admin-state"), process.env.DATABASE_URL);
    process.env.DATABASE_URL = "https://example.com/database";
    assert.throws(() => runtimeDatabaseConnectionString("/missing-admin-state"), /PostgreSQL/);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

test("protected DATABASE_URL_FILE takes precedence over legacy state and rejects ambiguity", () => {
  const directory = mkdtempSync(join(tmpdir(), "go-db-secret-"));
  const previousUrl = process.env.DATABASE_URL;
  const previousFile = process.env.DATABASE_URL_FILE;
  try {
    const secret = join(directory, "database-url");
    writeFileSync(secret, "postgresql://operator:password@postgres.example:5432/guild\\n".replace("\\n", "\n"), { mode: 0o600 });
    delete process.env.DATABASE_URL;
    process.env.DATABASE_URL_FILE = secret;
    assert.equal(runtimeDatabaseConnectionString("/missing-admin-state"), "postgresql://operator:password@postgres.example:5432/guild");
    process.env.DATABASE_URL = "postgresql://other:password@localhost:5432/other";
    assert.throws(() => runtimeDatabaseConnectionString("/missing-admin-state"), /only one/);
    delete process.env.DATABASE_URL;
    writeFileSync(secret, "");
    assert.throws(() => runtimeDatabaseConnectionString("/missing-admin-state"), /empty/);
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (previousFile === undefined) delete process.env.DATABASE_URL_FILE; else process.env.DATABASE_URL_FILE = previousFile;
    rmSync(directory, { recursive: true, force: true });
  }
});
