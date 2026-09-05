import { config } from "../../config.js";
import { pool, withTransaction } from "../../db.js";
import {
  RaffleRuleError,
  activateRaffleRound,
  raffleRound,
  type RaffleRound,
} from "./domain.js";
import { establishRaffleGuildEvent } from "./guild-event-registration.js";
import { publishRaffleEvent } from "./publisher.js";

export type ActiveRaffleRoundOverview = RaffleRound & {
  approvedTicketCount: number;
};

function isSingleLiveRoundViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: unknown; constraint?: unknown };
  return databaseError.code === "23505"
    && databaseError.constraint === "raffle_rounds_one_live_per_guild_idx";
}

async function raffleRoundOverview(round: RaffleRound): Promise<ActiveRaffleRoundOverview> {
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

export async function activateSingleRaffleRound(
  actorGuildieId: string,
  roundId: string,
): Promise<RaffleRound> {
  try {
    const round = await withTransaction(async (client) => {
      const activated = await activateRaffleRound(actorGuildieId, roundId, client);
      await establishRaffleGuildEvent(activated, client);
      return activated;
    });
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
  return round ? raffleRoundOverview(round) : null;
}

export async function nextListedRaffleRoundOverview(): Promise<ActiveRaffleRoundOverview | null> {
  const result = await pool.query<{ round_id: string }>(
    `SELECT round_id
       FROM raffle_rounds
      WHERE guild_id = $1
        AND status = 'listed'
      ORDER BY drawing_at_unix ASC, created_at_unix ASC, round_id ASC
      LIMIT 1`,
    [config.guild.id],
  );

  const roundId = result.rows[0]?.round_id;
  if (!roundId) return null;
  const round = await raffleRound(roundId);
  return round ? raffleRoundOverview(round) : null;
}
