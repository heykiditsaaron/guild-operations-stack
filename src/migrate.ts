import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { pool } from "./db.js";
import { installedActivityPluginMigrations } from "./core/activity/plugin-migrations.js";

const here = dirname(fileURLToPath(import.meta.url));
const sqlDirectory = resolve(here, "../sql");
const migrationFiles = (await readdir(sqlDirectory))
  .filter((fileName) => /^\d{3}_.+\.sql$/.test(fileName))
  .sort();

await pool.query("SELECT pg_advisory_lock(hashtext('guild_operations_migrations'))");

try {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       migration_owner text NOT NULL,
       migration_file text NOT NULL,
       applied_at timestamptz NOT NULL DEFAULT now(),
       PRIMARY KEY (migration_owner, migration_file)
     )`,
  );

  const appliedResult = await pool.query<{ migration_owner: string; migration_file: string }>(
    "SELECT migration_owner, migration_file FROM schema_migrations",
  );
  const applied = new Set(appliedResult.rows.map((row) => `${row.migration_owner}:\0${row.migration_file}`));

  async function applyMigration(owner: string, migrationFile: string, sql: string): Promise<void> {
    const key = `${owner}:\0${migrationFile}`;
    if (applied.has(key)) return;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (migration_owner, migration_file) VALUES ($1, $2)",
        [owner, migrationFile],
      );
      await client.query("COMMIT");
      applied.add(key);
      console.log(`Applied migration ${owner}/${migrationFile}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  for (const migrationFile of migrationFiles) {
    await applyMigration("core", migrationFile, await readFile(resolve(sqlDirectory, migrationFile), "utf8"));
  }

  for (const migration of await installedActivityPluginMigrations()) {
    await applyMigration(`activity:${migration.activityKind}`, migration.migrationFile, migration.sql);
  }
} finally {
  await pool.query("SELECT pg_advisory_unlock(hashtext('guild_operations_migrations'))");
  await pool.end();
}

console.log("Database migration complete");
