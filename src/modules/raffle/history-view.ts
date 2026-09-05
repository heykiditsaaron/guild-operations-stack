import { config } from "../../config.js";
import { pool } from "../../db.js";
import type { RaffleRound, RaffleRoundStatus } from "./domain.js";

export type RaffleHistoryRound = RaffleRound & {
  approvedTicketCount: number;
  winnerCharacterName: string | null;
};

function mapRound(row: Record<string, unknown>): RaffleHistoryRound {
  return {
    roundId: String(row.round_id),
    guildId: String(row.guild_id),
    status: row.status as RaffleRoundStatus,
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
    approvedTicketCount: Number(row.approved_ticket_count),
    winnerCharacterName: row.winner_character_name === null ? null : String(row.winner_character_name),
  };
}

export async function raffleHistory(): Promise<RaffleHistoryRound[]> {
  const result = await pool.query(
    `SELECT rr.*,
            COALESCE(SUM(rc.requested_ticket_count) FILTER (WHERE rc.resolution_kind = 'approved'), 0)::int AS approved_ticket_count,
            MAX(winner_character.name) AS winner_character_name
       FROM raffle_rounds rr
       LEFT JOIN raffle_claims rc ON rc.round_id = rr.round_id
       LEFT JOIN raffle_claims winner ON winner.claim_id = rr.winning_claim_id
       LEFT JOIN characters winner_character ON winner_character.character_record_id = winner.character_record_id
      WHERE rr.guild_id = $1
        AND rr.status IN ('drawn', 'admin_cancelled', 'no_entry_cancelled')
      GROUP BY rr.round_id
      ORDER BY rr.concluded_at DESC NULLS LAST, rr.round_id DESC`,
    [config.guild.id],
  );

  return result.rows.map((row) => mapRound(row as Record<string, unknown>));
}
