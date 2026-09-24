import {
  registerActivity,
  type ActivityTemporalProjection,
} from "../../core/activity/registry.js";
import { getRaffle } from "./application.js";
import { pool } from "../../db.js";

const RAFFLE_TEMPORAL_EMISSION_CODES = [
  "raffle.established",
  "raffle.modified",
  "raffle.concluded",
  "raffle.cancelled",
] as const;

async function raffleTemporalProjection(raffleId: string): Promise<ActivityTemporalProjection> {
  const raffle = await getRaffle(raffleId);
  if (!raffle) throw new Error(`Raffle ${raffleId} was not found while resolving Activity temporal relevance`);

  return {
    activityKind: "raffle",
    activityId: raffle.raffleId,
    occursAt: raffle.conclusion === "operator_cancelled" ? null : [raffle.drawingAtUnix],
  };
}

export function registerRaffleActivityIntegration(): void {
  registerActivity({
    kind: "raffle",
    participation: {
      async forGuildie(guildieId) {
        const result = await pool.query<{ raffle_id: string; claim_id: string }>(
          `SELECT raffle_id, claim_id
             FROM raffle_claims
            WHERE claimant_guildie_id = $1
            ORDER BY created_at_unix DESC, claim_id DESC`,
          [guildieId],
        );
        return result.rows.map((row) => ({
          activityKind: "raffle",
          activityId: row.raffle_id,
          participationId: row.claim_id,
        }));
      },
    },
    temporal: {
      emissionCodes: RAFFLE_TEMPORAL_EMISSION_CODES,
      projection: raffleTemporalProjection,
    },
  });
}
