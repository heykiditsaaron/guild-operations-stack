import { config } from "../../config.js";
import { pool } from "../../db.js";
import type {
  RafflePrizeKind,
  RaffleRound,
  RaffleRoundConclusion,
  RaffleRoundStatus,
} from "./domain.js";

export type RaffleHistoryRound = RaffleRound & {
  approvedTicketCount: number;
  winnerCharacterName: string | null;
};

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function mapRound(row: Record<string, unknown>): RaffleHistoryRound {
  return {
    roundId: String(row.round_id),
    guildId: String(row.guild_id),
    status: row.status as RaffleRoundStatus,
    conclusion: row.conclusion as RaffleRoundConclusion,
    drawingAtUnix: Number(row.drawing_at_unix),
    ticketPriceGold: String(row.ticket_price_gold),
    prizeKind: row.prize_kind as RafflePrizeKind,
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
    approvedTicketCount: Number(row.approved_ticket_count),
    winnerCharacterName: nullableString(row.winner_character_name),
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
        AND rr.status = 'concluded'
      GROUP BY rr.round_id
      ORDER BY rr.concluded_at_unix DESC NULLS LAST, rr.round_id DESC`,
    [config.guild.id],
  );

  return result.rows.map((row) => mapRound(row as Record<string, unknown>));
}
