import {
  registerActivity,
  type ActivityTemporalProjection,
} from "../../core/activity/registry.js";
import { raidEventFactsIncludingCancelled } from "./application.js";
import { pool } from "../../db.js";

const RAID_TEMPORAL_EMISSION_CODES = [
  "raid.established",
  "raid.modified",
  "raid.cancelled",
] as const;

async function raidTemporalProjection(raidId: string): Promise<ActivityTemporalProjection> {
  const raid = await raidEventFactsIncludingCancelled(raidId);
  if (!raid) throw new Error(`Raid ${raidId} was not found while resolving Activity temporal relevance`);

  return {
    activityKind: "raid",
    activityId: raid.raidId,
    occursAt: raid.cancelledAtUnix === null ? raid.occursAt : null,
  };
}

export function registerRaidActivityIntegration(): void {
  registerActivity({
    kind: "raid",
    participation: {
      async forGuildie(guildieId) {
        const result = await pool.query<{ raid_id: string; signup_row_id: string }>(
          `SELECT rr.raid_id, rr.signup_row_id
             FROM raid_signup_rows rr
             JOIN raid_applicants ra ON ra.applicant_id = rr.applicant_id
            WHERE ra.anchor_kind = 'guildie'
              AND ra.anchor_value = $1
            ORDER BY rr.created_at_unix DESC, rr.signup_row_id DESC`,
          [guildieId],
        );
        return result.rows.map((row) => ({
          activityKind: "raid",
          activityId: row.raid_id,
          participationId: row.signup_row_id,
        }));
      },
    },
    temporal: {
      emissionCodes: RAID_TEMPORAL_EMISSION_CODES,
      projection: raidTemporalProjection,
    },
  });
}
