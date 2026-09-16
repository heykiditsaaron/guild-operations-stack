import type { PoolClient } from "pg";
import {
  establishGuildEventPublication,
  withdrawGuildEventPublication,
} from "../../guild-events/publication/registry.js";
import type { RaffleRound } from "./domain.js";

export const RAFFLE_GUILD_EVENT_LABEL = "Guild Raffle";
export const RAFFLE_GUILD_EVENT_CATEGORY = "raffle";

export function raffleRoundDestination(roundId: string): string {
  return `/events/raffle/${encodeURIComponent(roundId)}`;
}

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
    destinations: [{
      kind: round.status === "live" ? "participate" : "view",
      label: round.status === "live" ? "View raffle / enter" : "View raffle",
      href: raffleRoundDestination(round.roundId),
    }],
  }, client);
}
