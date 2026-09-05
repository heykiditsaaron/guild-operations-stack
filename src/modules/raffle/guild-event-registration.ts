import type { PoolClient } from "pg";
import {
  establishGuildEventRegistration,
  withdrawGuildEventRegistration,
} from "../../guild-events/registry.js";
import type { RaffleRound } from "./domain.js";

export const RAFFLE_GUILD_EVENT_KIND = "raffle-round";
export const RAFFLE_GUILD_EVENT_CATEGORY = "raffle";

function unixSeconds(value: Date): number {
  return Math.floor(value.getTime() / 1000);
}

export async function establishRaffleGuildEvent(
  round: RaffleRound,
  client: PoolClient | null = null,
): Promise<void> {
  if (round.status === "admin_cancelled" && round.liveAt === null) {
    await withdrawGuildEventRegistration(round.roundId, client);
    return;
  }

  const occursAt = round.liveAt
    ? ([unixSeconds(round.liveAt), round.concludedAt ? unixSeconds(round.concludedAt) : round.drawingAtUnix] as const)
    : ([round.drawingAtUnix] as const);

  await establishGuildEventRegistration({
    guildEventId: round.roundId,
    guildEventKind: RAFFLE_GUILD_EVENT_KIND,
    guildEventOccursAt: occursAt,
    guildEventCategory: RAFFLE_GUILD_EVENT_CATEGORY,
  }, client);
}
