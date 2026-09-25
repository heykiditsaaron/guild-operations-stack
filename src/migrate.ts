import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { pool } from "./db.js";

const here = dirname(fileURLToPath(import.meta.url));
const sqlDirectory = resolve(here, "../sql");
const migrationFiles = (await readdir(sqlDirectory))
  .filter((fileName) => /^\d{3}_.+\.sql$/.test(fileName))
  .sort();

await pool.query("SELECT pg_advisory_lock(hashtext('guild_operations_migrations'))");

try {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       migration_file text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );

  const appliedResult = await pool.query<{ migration_file: string }>(
    "SELECT migration_file FROM schema_migrations",
  );
  const applied = new Set(appliedResult.rows.map((row) => row.migration_file));

  for (const migrationFile of migrationFiles) {
    if (applied.has(migrationFile)) continue;

    const migrationPath = resolve(sqlDirectory, migrationFile);
    const sql = await readFile(migrationPath, "utf8");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (migration_file) VALUES ($1)",
        [migrationFile],
      );
      await client.query("COMMIT");
      console.log(`Applied migration ${migrationFile}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.query("SELECT pg_advisory_unlock(hashtext('guild_operations_migrations'))");
  await pool.end();
}

console.log("Database migration complete");
