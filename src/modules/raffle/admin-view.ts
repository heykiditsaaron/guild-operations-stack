import { config } from "../../config.js";
import { pool } from "../../db.js";
import type { RaffleRound } from "./domain.js";

export type RaffleAdministrationRound = RaffleRound & {
  claimCount: number;
  pendingClaimCount: number;
  approvedClaimCount: number;
  cancelledClaimCount: number;
  deniedClaimCount: number;
  approvedTicketCount: number;
};

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function mapRound(row: Record<string, unknown>): RaffleAdministrationRound {
  return {
    roundId: String(row.round_id),
    guildId: String(row.guild_id),
    status: row.status as RaffleRound["status"],
    conclusion: row.conclusion as RaffleRound["conclusion"],
    drawingAtUnix: Number(row.drawing_at_unix),
    ticketPriceGold: String(row.ticket_price_gold),
    prizeKind: row.prize_kind as RaffleRound["prizeKind"],
    winnerPercentage: nullableNumber(row.winner_percentage),
    prizeDescription: nullableString(row.prize_description),
    createdByGuildieId: String(row.created_by_guildie_id),
    createdAtUnix: Number(row.created_at_unix),
    updatedByGuildieId: nullableString(row.updated_by_guildie_id),
    updatedAtUnix: nullableNumber(row.updated_at_unix),
    liveByGuildieId: nullableString(row.live_by_guildie_id),
    liveAtUnix: nullableNumber(row.live_at_unix),
    concludedByGuildieId: nullableString(row.concluded_by_guildie_id),
    concludedAtUnix: nullableNumber(row.concluded_at_unix),
    totalEntries: nullableNumber(row.total_entries),
    selectedIndex: nullableNumber(row.selected_index),
    winningClaimId: nullableString(row.winning_claim_id),
    claimCount: Number(row.claim_count),
    pendingClaimCount: Number(row.pending_claim_count),
    approvedClaimCount: Number(row.approved_claim_count),
    cancelledClaimCount: Number(row.cancelled_claim_count),
    deniedClaimCount: Number(row.denied_claim_count),
    approvedTicketCount: Number(row.approved_ticket_count),
  };
}

export async function raffleRoundsForAdministration(): Promise<RaffleAdministrationRound[]> {
  const result = await pool.query(
    `SELECT rr.*,
            COUNT(rc.claim_id)::int AS claim_count,
            COUNT(rc.claim_id) FILTER (WHERE rc.resolution_kind IS NULL)::int AS pending_claim_count,
            COUNT(rc.claim_id) FILTER (WHERE rc.resolution_kind = 'approved')::int AS approved_claim_count,
            COUNT(rc.claim_id) FILTER (WHERE rc.resolution_kind = 'cancelled')::int AS cancelled_claim_count,
            COUNT(rc.claim_id) FILTER (WHERE rc.resolution_kind = 'denied')::int AS denied_claim_count,
            COALESCE(SUM(rc.requested_ticket_count) FILTER (WHERE rc.resolution_kind = 'approved'), 0)::int AS approved_ticket_count
       FROM raffle_rounds rr
       LEFT JOIN raffle_claims rc ON rc.round_id = rr.round_id
      WHERE rr.guild_id = $1
        AND rr.status IN ('live', 'listed')
      GROUP BY rr.round_id
      ORDER BY
        CASE rr.status WHEN 'live' THEN 0 ELSE 1 END,
        rr.drawing_at_unix ASC,
        rr.round_id ASC`,
    [config.guild.id],
  );

  return result.rows.map((row) => mapRound(row as Record<string, unknown>));
}
