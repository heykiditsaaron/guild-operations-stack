import { config } from "../config.js";
import { pool } from "../db.js";
import type { RaffleClaimResolution } from "./domain.js";

export type RaffleMemberClaim = {
  claimId: string;
  roundId: string;
  characterId: string;
  realmId: string;
  characterName: string;
  requestedTicketCount: number;
  promisedGoldValue: string;
  createdAt: Date;
  resolutionKind: RaffleClaimResolution;
  denialReason: string | null;
};

export async function raffleClaimsForMember(subjectId: string, roundId: string): Promise<RaffleMemberClaim[]> {
  const result = await pool.query(
    `SELECT
       rc.claim_id,
       rc.round_id,
       rc.requested_ticket_count,
       rc.promised_gold_value,
       rc.created_at,
       rc.resolution_kind,
       rc.denial_reason,
       c.character_id,
       c.realm_id,
       COALESCE(grm.character_name, c.name) AS character_name
     FROM raffle_claims rc
     JOIN raffle_rounds rr
       ON rr.round_id = rc.round_id
      AND rr.guild_id = $3
     JOIN characters c ON c.character_record_id = rc.character_record_id
     LEFT JOIN guild_roster_memberships grm
       ON grm.guild_id = rr.guild_id
      AND grm.region = c.region
      AND grm.realm_id = c.realm_id
      AND grm.character_id = c.character_id
    WHERE rc.round_id = $1
      AND rc.subject_id = $2
    ORDER BY rc.created_at DESC, rc.claim_id DESC`,
    [roundId, subjectId, config.guild.id],
  );

  return result.rows.map((row) => ({
    claimId: String(row.claim_id),
    roundId: String(row.round_id),
    characterId: String(row.character_id),
    realmId: String(row.realm_id),
    characterName: String(row.character_name),
    requestedTicketCount: Number(row.requested_ticket_count),
    promisedGoldValue: String(row.promised_gold_value),
    createdAt: row.created_at as Date,
    resolutionKind: row.resolution_kind as RaffleClaimResolution,
    denialReason: row.denial_reason === null ? null : String(row.denial_reason),
  }));
}
