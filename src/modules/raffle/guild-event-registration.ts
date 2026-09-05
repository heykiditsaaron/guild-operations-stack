import type { PoolClient } from "pg";
import {
  establishGuildEventListing,
  withdrawGuildEventListing,
} from "../../guild-events/registry.js";
import type { RaffleRound } from "./domain.js";

export const RAFFLE_GUILD_EVENT_KIND = "raffle-round";
export const RAFFLE_GUILD_EVENT_TITLE = "Guild Raffle";
export const RAFFLE_GUILD_EVENT_DESTINATION = "/events/raffle";
export const RAFFLE_GUILD_EVENT_CATEGORY = "raffle";

function unixSeconds(value: Date): number {
  return Math.floor(value.getTime() / 1000);
}

export async function establishRaffleGuildEvent(
  round: RaffleRound,
  client: PoolClient | null = null,
): Promise<void> {
  if (round.status === "admin_cancelled" && round.liveAt === null) {
    await withdrawGuildEventListing(round.roundId, client);
    return;
  }

  const occursAt = round.liveAt
    ? ([unixSeconds(round.liveAt), round.concludedAt ? unixSeconds(round.concludedAt) : round.drawingAtUnix] as const)
    : ([round.drawingAtUnix] as const);

  await establishGuildEventListing({
    guildEventId: round.roundId,
    guildEventKind: RAFFLE_GUILD_EVENT_KIND,
    guildEventOccursAt: occursAt,
    guildEventTitle: RAFFLE_GUILD_EVENT_TITLE,
    guildEventDestination: RAFFLE_GUILD_EVENT_DESTINATION,
    guildEventCategory: RAFFLE_GUILD_EVENT_CATEGORY,
  }, client);
}
