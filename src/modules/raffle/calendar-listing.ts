import type { PoolClient } from "pg";
import { pool } from "../../db.js";
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

export async function reconcileRaffleCalendarListingDestinations(): Promise<void> {
  const result = await pool.query<{
    guild_event_id: string;
    guild_event_destination: string | null;
  }>(
    `SELECT guild_event_id, guild_event_destination
       FROM guild_event_calendar_listings
      WHERE guild_event_kind = $1`,
    [RAFFLE_GUILD_EVENT_KIND],
  );

  const staleListings = result.rows.filter(
    (row) => row.guild_event_destination !== raffleRoundDestination(row.guild_event_id),
  );
  if (staleListings.length === 0) return;

  const updatedAtUnix = Math.floor(Date.now() / 1000);
  await Promise.all(
    staleListings.map((row) => pool.query(
      `UPDATE guild_event_calendar_listings
          SET guild_event_destination = $3,
              updated_at_unix = $4
        WHERE guild_event_id = $1
          AND guild_event_kind = $2`,
      [
        row.guild_event_id,
        RAFFLE_GUILD_EVENT_KIND,
        raffleRoundDestination(row.guild_event_id),
        updatedAtUnix,
      ],
    )),
  );
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
