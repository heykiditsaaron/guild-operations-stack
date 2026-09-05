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

function mapRound(row: Record<string, unknown>): RaffleAdministrationRound {
  return {
    roundId: String(row.round_id),
    guildId: String(row.guild_id),
    status: row.status as RaffleRound["status"],
    drawingAtUnix: Number(row.drawing_at_unix),
    ticketPriceGold: String(row.ticket_price_gold),
    prizeKind: String(row.prize_kind),
    winnerPercentage: row.winner_percentage === null ? null : Number(row.winner_percentage),
    createdBySubjectId: String(row.created_by_subject_id),
    createdAt: row.created_at as Date,
    updatedBySubjectId: row.updated_by_subject_id === null || row.updated_by_subject_id === undefined ? null : String(row.updated_by_subject_id),
    updatedAt: row.updated_at as Date | null,
    liveBySubjectId: row.live_by_subject_id === null ? null : String(row.live_by_subject_id),
    liveAt: row.live_at as Date | null,
    concludedBySubjectId: row.concluded_by_subject_id === null ? null : String(row.concluded_by_subject_id),
    concludedAt: row.concluded_at as Date | null,
    totalEntries: row.total_entries === null ? null : Number(row.total_entries),
    selectedIndex: row.selected_index === null ? null : Number(row.selected_index),
    winningClaimId: row.winning_claim_id === null ? null : String(row.winning_claim_id),
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
      GROUP BY rr.round_id
      ORDER BY
        CASE rr.status
          WHEN 'live' THEN 0
          WHEN 'created' THEN 1
          ELSE 2
        END,
        COALESCE(rr.concluded_at, rr.created_at) DESC,
        rr.round_id DESC`,
    [config.guild.id],
  );

  return result.rows.map((row) => mapRound(row as Record<string, unknown>));
}
