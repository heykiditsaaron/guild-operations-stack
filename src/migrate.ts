import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { pool } from "./db.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationFiles = [
  "000_guildie_persistence.sql",
  "001_initial.sql",
  "002_raffle.sql",
  "005_guild_event_registry.sql",
  "007_guild_event_listing_projection.sql",
  "008_raffle_round_title.sql",
  "009_guild_event_calendar.sql",
  "010_operational_inspection.sql",
  "011_guild_refresh_schedule.sql",
  "012_guildie_discord_projection.sql",
  "013_guild_calendar_contract.sql",
  "014_raffle_entry_vocabulary.sql",
  "015_discord_module.sql",
  "016_discord_role_map_enablement.sql",
  "018_remove_group_coordinator.sql",
  "019_raid_module.sql",
  "020_raid_external_anchor.sql",
  "021_raid_assignment_derived_composition.sql",
  "022_raid_permission_split.sql",
  "023_raid_permission_administration.sql",
  "024_module_lifecycle.sql",
  "025_guild_refresh_schedule_capability.sql",
  "026_global_permission_administration.sql",
  "027_guild_event_publications.sql",
  "028_raid_definition_operations.sql",
];

for (const migrationFile of migrationFiles) {
  const migrationPath = resolve(here, `../sql/${migrationFile}`);
  const sql = await readFile(migrationPath, "utf8");
  await pool.query(sql);
}

await pool.end();
console.log("Database migration complete");
