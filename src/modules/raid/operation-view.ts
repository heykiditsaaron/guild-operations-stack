import { config } from "../../config.js";
import { pool } from "../../db.js";
import type { RaidDifficulty, RaidEligibility } from "./domain.js";

export type RaidOperationEvent = {
  raidId: string;
  label: string;
  description: string | null;
  occursAt: readonly [number] | readonly [number, number];
  tags: string[];
  eligibility: RaidEligibility;
  difficulty: RaidDifficulty;
};

export async function raidsForOperation(): Promise<RaidOperationEvent[]> {
  const result = await pool.query<{
    raid_id: string; label: string; description: string | null; occurs_start_unix: string; occurs_end_unix: string | null;
    tags: string[]; eligibility: RaidEligibility; difficulty: RaidDifficulty;
  }>(
    `SELECT raid_id, label, description, occurs_start_unix, occurs_end_unix,
            tags, eligibility, difficulty
       FROM raid_events
      WHERE guild_id = $1
        AND cancelled_at_unix IS NULL
      ORDER BY occurs_start_unix ASC, created_at_unix ASC`,
    [config.guild.id],
  );

  return result.rows.map((row) => {
    const start = Number(row.occurs_start_unix);
    const end = row.occurs_end_unix === null ? null : Number(row.occurs_end_unix);
    return {
      raidId: row.raid_id, label: row.label, description: row.description, occursAt: end === null ? [start] : [start, end], tags: row.tags,
      eligibility: row.eligibility, difficulty: row.difficulty,
    };
  });
}
