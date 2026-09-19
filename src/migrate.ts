import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { pool } from "./db.js";

const here = dirname(fileURLToPath(import.meta.url));
const sqlDirectory = resolve(here, "../sql");
const migrationFiles = (await readdir(sqlDirectory))
  .filter((fileName) => /^\d{3}_.+\.sql$/.test(fileName))
  .sort();

async function tableExists(tableName: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    "SELECT to_regclass($1) IS NOT NULL AS exists",
    [`public.${tableName}`],
  );
  return result.rows[0]?.exists ?? false;
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = $1
          AND column_name = $2
     ) AS exists`,
    [tableName, columnName],
  );
  return result.rows[0]?.exists ?? false;
}

async function recordLegacyBaseline(): Promise<void> {
  const recorded = await pool.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM schema_migrations",
  );
  const recordedCount = Number(recorded.rows[0]?.count ?? "0");

  const hasLegacyRoot = await tableExists("guild_subjects");
  const hasCurrentRoot = await tableExists("guildies");
  if (!hasLegacyRoot && !hasCurrentRoot) return;

  let baselineFile: string | null = null;

  const hasRaffles = await tableExists("raffles");
  if (hasRaffles) {
    const hasParticipationClosure = await columnExists("raffles", "participation_closed_at_unix");
    const hasLegacyStatus = await columnExists("raffles", "status");
    if (hasParticipationClosure && !hasLegacyStatus) {
      baselineFile = "034_raffle_participation_state.sql";
    }
  }

  if (!baselineFile && await tableExists("raid_events")) {
    const hasLegacySignupFlag = await columnExists("raid_events", "signups_open");
    const hasLegacyCancellationTime = await columnExists("raid_events", "cancelled_at_unix");
    const hasLegacyCancellationActor = await columnExists("raid_events", "cancelled_by_guildie_id");
    if (!hasLegacySignupFlag && !hasLegacyCancellationTime && !hasLegacyCancellationActor) {
      baselineFile = "031_raid_occurrence_lifecycle.sql";
    }
  }

  if (!baselineFile) {
    if (recordedCount > 0) return;
    throw new Error(
      "Existing database has no migration ledger and does not match a recognized Guild Operations schema baseline.",
    );
  }

  const baselineIndex = migrationFiles.indexOf(baselineFile);
  if (baselineIndex < 0) {
    throw new Error(`Recognized migration baseline is missing from sql/: ${baselineFile}`);
  }

  for (const migrationFile of migrationFiles.slice(0, baselineIndex + 1)) {
    await pool.query(
      `INSERT INTO schema_migrations (migration_file)
       VALUES ($1)
       ON CONFLICT (migration_file) DO NOTHING`,
      [migrationFile],
    );
  }

  console.log(`Recorded existing database baseline through ${baselineFile}`);
}

await pool.query("SELECT pg_advisory_lock(hashtext('guild_operations_migrations'))");

try {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       migration_file text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );

  await recordLegacyBaseline();

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
