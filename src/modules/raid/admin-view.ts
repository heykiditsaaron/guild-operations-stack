import { config } from "../../config.js";
import { pool } from "../../db.js";
import type { RaidEligibility } from "./domain.js";

export type RaidAdministrationEvent = {
  raidId: string;
  label: string;
  description: string | null;
  occursAt: readonly [number] | readonly [number, number];
  tags: string[];
  eligibility: RaidEligibility;
  raidSize: number;
  signupsOpen: boolean;
};

export async function raidsForAdministration(): Promise<RaidAdministrationEvent[]> {
  const result = await pool.query<{
    raid_id: string;
    label: string;
    description: string | null;
    occurs_start_unix: string;
    occurs_end_unix: string | null;
    tags: string[];
    eligibility: RaidEligibility;
    raid_size: number;
    signups_open: boolean;
  }>(
    `SELECT raid_id, label, description, occurs_start_unix, occurs_end_unix,
            tags, eligibility, raid_size, signups_open
       FROM raid_events
      WHERE guild_id = $1
      ORDER BY occurs_start_unix ASC, created_at_unix ASC`,
    [config.guild.id],
  );

  return result.rows.map((row) => {
    const start = Number(row.occurs_start_unix);
    const end = row.occurs_end_unix === null ? null : Number(row.occurs_end_unix);
    return {
      raidId: row.raid_id,
      label: row.label,
      description: row.description,
      occursAt: end === null ? [start] : [start, end],
      tags: row.tags,
      eligibility: row.eligibility,
      raidSize: row.raid_size,
      signupsOpen: row.signups_open,
    };
  });
}
