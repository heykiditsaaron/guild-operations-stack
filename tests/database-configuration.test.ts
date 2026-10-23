import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const script = 'import { config } from "./src/config.ts"; process.stdout.write(config.databaseUrl);';

test("database connection is read from DATABASE_URL", () => {
  const url = "postgresql://example:secret@database.example:5432/guild_operations";
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: url },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, url);
});

test("missing DATABASE_URL fails before application startup", () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
    encoding: "utf8",
    env,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing required environment variable: DATABASE_URL/);
});
