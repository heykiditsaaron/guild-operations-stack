import type { PoolClient } from "pg";
import {
  establishGuildEventPublication,
  withdrawGuildEventPublication,
} from "../../guild-events/publication/registry.js";
import { raffleRoundDestinations } from "./destinations.js";
import type { RaffleRound } from "./domain.js";

export const RAFFLE_GUILD_EVENT_LABEL = "Guild Raffle";
export const RAFFLE_GUILD_EVENT_CATEGORY = "raffle";

/**
 * Compatibility projection into the current shared event-publication registry.
 * Raffle owns the round, lifecycle, temporal facts, and destinations; this
 * adapter only translates those established facts for current event discovery.
 * It is intentionally not a Raffle domain boundary or Calendar architecture.
 */
export async function establishRaffleEventPublication(round: RaffleRound, client: PoolClient | null = null): Promise<void> {
  if (round.status === "concluded" && round.conclusion === "operator_cancelled") {
    await withdrawGuildEventPublication(round.roundId, client);
    return;
  }

  const occurrence = round.liveAtUnix !== null
    ? ([round.liveAtUnix, round.concludedAtUnix ?? round.drawingAtUnix] as const)
    : ([round.drawingAtUnix] as const);
  const prize = round.prizeKind === "gold" ? `${round.winnerPercentage ?? 0}% of the pot` : round.prizeDescription;
  const description = prize ? `${prize} · ${round.entryPriceGold} gold per entry` : `${round.entryPriceGold} gold per entry`;

  await establishGuildEventPublication({
    publicationId: round.roundId,
    label: round.roundTitle ?? RAFFLE_GUILD_EVENT_LABEL,
    occursAt: [occurrence],
    description,
    category: RAFFLE_GUILD_EVENT_CATEGORY,
    tags: ["raffle", round.prizeKind],
    destinations: raffleRoundDestinations(round),
  }, client);
}
