import { config } from "../../config.js";
import { pool } from "../../db.js";
import type {
  RaffleClaimResolution,
  RafflePrizeKind,
  RaffleRoundConclusion,
  RaffleRoundStatus,
} from "./domain.js";

export type RafflePublicClaim = {
  claimId: string;
  characterName: string;
  requestedTicketCount: number;
  promisedGoldValue: string;
  createdAtUnix: number;
  resolutionKind: RaffleClaimResolution;
  resolvedAtUnix: number | null;
  denialReason: string | null;
};

export type RafflePublicRound = {
  roundId: string;
  status: RaffleRoundStatus;
  conclusion: RaffleRoundConclusion;
  roundTitle: string | null;
  drawingAtUnix: number;
  ticketPriceGold: string;
  prizeKind: RafflePrizeKind;
  winnerPercentage: number | null;
  prizeDescription: string | null;
  createdAtUnix: number;
  liveAtUnix: number | null;
  concludedAtUnix: number | null;
  totalEntries: number | null;
  approvedEntryCount: number;
  winnerCharacterName: string | null;
  claims: RafflePublicClaim[];
};

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function resolvedAtUnix(row: Record<string, unknown>): number | null {
  if (row.resolution_kind === "approved") return nullableNumber(row.approved_at_unix);
  if (row.resolution_kind === "denied") return nullableNumber(row.denied_at_unix);
  if (row.resolution_kind === "cancelled") return nullableNumber(row.cancelled_at_unix);
  return null;
}

export async function rafflePublicRound(roundId: string): Promise<RafflePublicRound | null> {
  const roundResult = await pool.query(
    `SELECT rr.*,
            COALESCE(SUM(rc.requested_ticket_count) FILTER (WHERE rc.resolution_kind = 'approved'), 0)::int AS approved_entry_count,
            MAX(winner_character.name) AS winner_character_name
       FROM raffle_rounds rr
       LEFT JOIN raffle_claims rc ON rc.round_id = rr.round_id
       LEFT JOIN raffle_claims winner ON winner.claim_id = rr.winning_claim_id
       LEFT JOIN characters winner_character ON winner_character.character_record_id = winner.character_record_id
      WHERE rr.round_id = $1
        AND rr.guild_id = $2
      GROUP BY rr.round_id`,
    [roundId, config.guild.id],
  );

  if (!roundResult.rowCount) return null;

  const claimResult = await pool.query(
    `SELECT
       rc.claim_id,
       rc.requested_ticket_count,
       rc.promised_gold_value,
       rc.created_at_unix,
       rc.resolution_kind,
       rc.approved_at_unix,
       rc.denied_at_unix,
       rc.denial_reason,
       rc.cancelled_at_unix,
       COALESCE(grm.character_name, c.name) AS character_name
     FROM raffle_claims rc
     JOIN raffle_rounds rr
       ON rr.round_id = rc.round_id
      AND rr.guild_id = $2
     JOIN characters c ON c.character_record_id = rc.character_record_id
     LEFT JOIN guild_roster_memberships grm
       ON grm.guild_id = rr.guild_id
      AND grm.region = c.region
      AND grm.realm_id = c.realm_id
      AND grm.character_id = c.character_id
    WHERE rc.round_id = $1
    ORDER BY rc.created_at_unix ASC, rc.claim_id ASC`,
    [roundId, config.guild.id],
  );

  const row = roundResult.rows[0] as Record<string, unknown>;
  const claims = claimResult.rows.map((claimRow) => {
    const claim = claimRow as Record<string, unknown>;
    return {
      claimId: String(claim.claim_id),
      characterName: String(claim.character_name),
      requestedTicketCount: Number(claim.requested_ticket_count),
      promisedGoldValue: String(claim.promised_gold_value),
      createdAtUnix: Number(claim.created_at_unix),
      resolutionKind: claim.resolution_kind as RaffleClaimResolution,
      resolvedAtUnix: resolvedAtUnix(claim),
      denialReason: nullableString(claim.denial_reason),
    } satisfies RafflePublicClaim;
  });

  return {
    roundId: String(row.round_id),
    status: row.status as RaffleRoundStatus,
    conclusion: row.conclusion as RaffleRoundConclusion,
    roundTitle: nullableString(row.round_title),
    drawingAtUnix: Number(row.drawing_at_unix),
    ticketPriceGold: String(row.ticket_price_gold),
    prizeKind: row.prize_kind as RafflePrizeKind,
    winnerPercentage: nullableNumber(row.winner_percentage),
    prizeDescription: nullableString(row.prize_description),
    createdAtUnix: Number(row.created_at_unix),
    liveAtUnix: nullableNumber(row.live_at_unix),
    concludedAtUnix: nullableNumber(row.concluded_at_unix),
    totalEntries: nullableNumber(row.total_entries),
    approvedEntryCount: Number(row.approved_entry_count),
    winnerCharacterName: nullableString(row.winner_character_name),
    claims,
  };
}
