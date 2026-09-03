import { config } from "../config.js";
import { pool } from "../db.js";
import type { RaffleRound } from "./domain.js";

function mapRound(row: Record<string, unknown>): RaffleRound {
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
    liveBySubjectId: row.live_by_subject_id === null ? null : String(row.live_by_subject_id),
    liveAt: row.live_at as Date | null,
    concludedBySubjectId: row.concluded_by_subject_id === null ? null : String(row.concluded_by_subject_id),
    concludedAt: row.concluded_at as Date | null,
    totalEntries: row.total_entries === null ? null : Number(row.total_entries),
    selectedIndex: row.selected_index === null ? null : Number(row.selected_index),
    winningClaimId: row.winning_claim_id === null ? null : String(row.winning_claim_id),
  };
}

export async function raffleRoundsForAdministration(): Promise<RaffleRound[]> {
  const result = await pool.query(
    `SELECT *
       FROM raffle_rounds
      WHERE guild_id = $1
      ORDER BY
        CASE status
          WHEN 'live' THEN 0
          WHEN 'created' THEN 1
          ELSE 2
        END,
        COALESCE(concluded_at, created_at) DESC,
        round_id DESC`,
    [config.guild.id],
  );

  return result.rows.map((row) => mapRound(row as Record<string, unknown>));
}
