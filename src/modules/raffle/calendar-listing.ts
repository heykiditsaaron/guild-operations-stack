import type { PoolClient } from "pg";
import { pool } from "../../db.js";
import {
  establishGuildCalendarEvent,
  withdrawGuildCalendarEvent,
} from "../../guild-events/calendar/registry.js";
import type { RaffleRound } from "./domain.js";

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
    `SELECT listing.guild_event_id, listing.guild_event_destination
       FROM guild_event_calendar_listings AS listing
       JOIN raffle_rounds AS round
         ON round.round_id::text = listing.guild_event_id`,
  );

  const staleListings = result.rows.filter(
    (row) => row.guild_event_destination !== raffleRoundDestination(row.guild_event_id),
  );
  if (staleListings.length === 0) return;

  const updatedAtUnix = Math.floor(Date.now() / 1000);
  await Promise.all(
    staleListings.map((row) => pool.query(
      `UPDATE guild_event_calendar_listings
          SET guild_event_destination = $2,
              updated_at_unix = $3
        WHERE guild_event_id = $1`,
      [
        row.guild_event_id,
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
    await withdrawGuildCalendarEvent(round.roundId, client);
    return;
  }

  const occursAt = round.liveAtUnix !== null
    ? ([round.liveAtUnix, round.concludedAtUnix ?? round.drawingAtUnix] as const)
    : ([round.drawingAtUnix] as const);

  await establishGuildCalendarEvent({
    eventId: round.roundId,
    occursAt,
    title: round.roundTitle ?? RAFFLE_GUILD_EVENT_TITLE,
    destination: raffleRoundDestination(round.roundId),
    category: RAFFLE_GUILD_EVENT_CATEGORY,
  }, client);
}
