import type { PoolClient } from "pg";
import {
  establishGuildEventCalendarListing,
  withdrawGuildEventCalendarListing,
} from "../../guild-events/calendar/registry.js";
import type { RaffleRound } from "./domain.js";

export const RAFFLE_GUILD_EVENT_KIND = "raffle-round";
export const RAFFLE_GUILD_EVENT_TITLE = "Guild Raffle";
export const RAFFLE_GUILD_EVENT_CATEGORY = "raffle";

export function raffleRoundDestination(roundId: string): string {
  return `/events/raffle/${encodeURIComponent(roundId)}`;
}

export async function establishRaffleCalendarListing(
  round: RaffleRound,
  client: PoolClient | null = null,
): Promise<void> {
  if (round.status === "concluded" && round.conclusion === "operator_cancelled") {
    await withdrawGuildEventCalendarListing(round.roundId, client);
    return;
  }

  const occursAt = round.liveAtUnix !== null
    ? ([round.liveAtUnix, round.concludedAtUnix ?? round.drawingAtUnix] as const)
    : ([round.drawingAtUnix] as const);

  await establishGuildEventCalendarListing({
    guildEventId: round.roundId,
    guildEventKind: RAFFLE_GUILD_EVENT_KIND,
    guildEventOccursAt: occursAt,
    guildEventTitle: round.roundTitle ?? RAFFLE_GUILD_EVENT_TITLE,
    guildEventDestination: raffleRoundDestination(round.roundId),
    guildEventCategory: RAFFLE_GUILD_EVENT_CATEGORY,
  }, client);
}
