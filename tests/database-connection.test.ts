import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hostDatabaseConnectionString } from "../src/database-connection.js";

test("host database connection requires explicit configuration", () => {
  assert.throws(() => hostDatabaseConnectionString({}), /not configured/);
});

test("host database connection accepts PostgreSQL URL", () => {
  const url = "postgresql://operator:password@postgres.example:5432/guild";
  assert.equal(hostDatabaseConnectionString({ DATABASE_URL: url }), url);
  assert.throws(() => hostDatabaseConnectionString({ DATABASE_URL: "https://example.com" }), /PostgreSQL/);
});

test("host database connection reads protected URL file and rejects conflicting inputs", () => {
  const directory = mkdtempSync(join(tmpdir(), "go-db-connection-"));
  try {
    const path = join(directory, "url");
    const url = "postgresql://operator:password@postgres.example:5432/guild";
    writeFileSync(path, url + "\n", { mode: 0o600 });
    assert.equal(hostDatabaseConnectionString({ DATABASE_URL_FILE: path }), url);
    assert.throws(() => hostDatabaseConnectionString({ DATABASE_URL_FILE: path, DATABASE_URL: url }), /only one/);
    writeFileSync(path, "");
    assert.throws(() => hostDatabaseConnectionString({ DATABASE_URL_FILE: path }), /empty/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
