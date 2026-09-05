import { config } from "../../config.js";
import { pool } from "../../db.js";
import {
  RaffleRuleError,
  activateRaffleRound,
  raffleRound,
  type RaffleRound,
} from "./domain.js";
import { publishRaffleEvent } from "./publisher.js";
import { coupleGuildEventListing } from "./registered-operations.js";

export type ActiveRaffleRoundOverview = RaffleRound & {
  approvedTicketCount: number;
};

function isSingleLiveRoundViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: unknown; constraint?: unknown };
  return databaseError.code === "23505"
    && databaseError.constraint === "raffle_rounds_one_live_per_guild_idx";
}

export async function activateSingleRaffleRound(
  actorSubjectId: string,
  roundId: string,
): Promise<RaffleRound> {
  try {
    const round = await activateRaffleRound(actorSubjectId, roundId);
    await coupleGuildEventListing(round);
    await publishRaffleEvent({ kind: "raffle.round.live", roundId: round.roundId });
    return round;
  } catch (error) {
    if (isSingleLiveRoundViolation(error)) {
      throw new RaffleRuleError(
        "active_round_exists",
        "Another raffle round is already live for the guild",
      );
    }
    throw error;
  }
}

export async function activeRaffleRound(): Promise<RaffleRound | null> {
  const result = await pool.query<{ round_id: string }>(
    `SELECT round_id
       FROM raffle_rounds
      WHERE guild_id = $1
        AND status = 'live'`,
    [config.guild.id],
  );

  if (result.rowCount === 0) return null;
  if ((result.rowCount ?? 0) > 1) {
    throw new RaffleRuleError(
      "multiple_live_rounds",
      "Raffle state is invalid: more than one live round exists for the guild",
      500,
    );
  }

  return raffleRound(result.rows[0].round_id);
}

export async function activeRaffleRoundOverview(): Promise<ActiveRaffleRoundOverview | null> {
  const round = await activeRaffleRound();
  if (!round) return null;

  const result = await pool.query<{ approved_ticket_count: number }>(
    `SELECT COALESCE(SUM(requested_ticket_count), 0)::int AS approved_ticket_count
       FROM raffle_claims
      WHERE round_id = $1
        AND resolution_kind = 'approved'`,
    [round.roundId],
  );

  return {
    ...round,
    approvedTicketCount: Number(result.rows[0]?.approved_ticket_count ?? 0),
  };
}
