import type { PoolClient } from "pg";
import { pool } from "../../db.js";

export type GuildCalendarOccursAt = readonly [number] | readonly [number, number];

export type GuildCalendarEventInput = {
  eventId: string;
  title: string;
  occursAt: GuildCalendarOccursAt;
  destination?: string | null;
  category?: string | null;
};

export type GuildCalendarEvent = {
  eventId: string;
  title: string;
  occursAt: GuildCalendarOccursAt;
  destination: string | null;
  category: string | null;
  registeredAtUnix: number;
  updatedAtUnix: number;
};

type GuildCalendarManagementKind = "application" | "external";

type GuildCalendarEventRow = {
  guild_event_id: string;
  occurs_at_start_unix: string;
  occurs_at_end_unix: string | null;
  guild_event_title: string;
  guild_event_destination: string | null;
  guild_event_category: string | null;
  registered_at_unix: string;
  updated_at_unix: string;
};

function validateUnix(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative Unix timestamp`);
  }
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function optionalText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function normalizeEvent(input: GuildCalendarEventInput): GuildCalendarEventInput {
  const eventId = requiredText(input.eventId, "eventId");
  const title = requiredText(input.title, "title");

  if (input.occursAt.length !== 1 && input.occursAt.length !== 2) {
    throw new Error("occursAt must contain one Unix instant or a start/end Unix range");
  }

  const [start, end] = input.occursAt;
  validateUnix(start, "occursAt[0]");
  if (end !== undefined) {
    validateUnix(end, "occursAt[1]");
    if (end < start) throw new Error("occursAt end must not precede start");
  }

  return {
    eventId,
    title,
    occursAt: end === undefined ? [start] : [start, end],
    destination: optionalText(input.destination),
    category: optionalText(input.category),
  };
}

function mapEvent(row: GuildCalendarEventRow): GuildCalendarEvent {
  const start = Number(row.occurs_at_start_unix);
  const end = row.occurs_at_end_unix === null ? null : Number(row.occurs_at_end_unix);
  return {
    eventId: row.guild_event_id,
    title: row.guild_event_title,
    occursAt: end === null ? [start] : [start, end],
    destination: row.guild_event_destination,
    category: row.guild_event_category,
    registeredAtUnix: Number(row.registered_at_unix),
    updatedAtUnix: Number(row.updated_at_unix),
  };
}

async function establishManagedGuildCalendarEvent(
  input: GuildCalendarEventInput,
  managementKind: GuildCalendarManagementKind,
  client: PoolClient | null = null,
): Promise<GuildCalendarEvent> {
  const event = normalizeEvent(input);
  const nowUnix = Math.floor(Date.now() / 1000);
  const executor = client ?? pool;
  const [start, end] = event.occursAt;

  const result = await executor.query<GuildCalendarEventRow>(
    `INSERT INTO guild_event_calendar_listings (
       guild_event_id,
       occurs_at_start_unix, occurs_at_end_unix,
       guild_event_title, guild_event_destination, guild_event_category,
       discoverable, registered_at_unix, updated_at_unix, management_kind
     ) VALUES ($1,$2,$3,$4,$5,$6,true,$7,$7,$8)
     ON CONFLICT (guild_event_id) DO UPDATE
       SET occurs_at_start_unix = EXCLUDED.occurs_at_start_unix,
           occurs_at_end_unix = EXCLUDED.occurs_at_end_unix,
           guild_event_title = EXCLUDED.guild_event_title,
           guild_event_destination = EXCLUDED.guild_event_destination,
           guild_event_category = EXCLUDED.guild_event_category,
           discoverable = true,
           updated_at_unix = EXCLUDED.updated_at_unix
       WHERE guild_event_calendar_listings.management_kind = EXCLUDED.management_kind
     RETURNING guild_event_id, occurs_at_start_unix, occurs_at_end_unix,
               guild_event_title, guild_event_destination, guild_event_category,
               registered_at_unix, updated_at_unix`,
    [
      event.eventId,
      start,
      end ?? null,
      event.title,
      event.destination ?? null,
      event.category ?? null,
      nowUnix,
      managementKind,
    ],
  );

  const row = result.rows[0];
  if (!row) throw new Error("calendar event is managed by a different authority class");
  return mapEvent(row);
}

export async function establishGuildCalendarEvent(
  input: GuildCalendarEventInput,
  client: PoolClient | null = null,
): Promise<GuildCalendarEvent> {
  return establishManagedGuildCalendarEvent(input, "application", client);
}

export async function establishExternallyManagedGuildCalendarEvent(
  input: GuildCalendarEventInput,
): Promise<GuildCalendarEvent> {
  return establishManagedGuildCalendarEvent(input, "external");
}

async function withdrawManagedGuildCalendarEvent(
  eventId: string,
  managementKind: GuildCalendarManagementKind,
  client: PoolClient | null = null,
): Promise<boolean> {
  const normalizedEventId = requiredText(eventId, "eventId");
  const nowUnix = Math.floor(Date.now() / 1000);
  const executor = client ?? pool;
  const result = await executor.query(
    `UPDATE guild_event_calendar_listings
        SET discoverable = false,
            updated_at_unix = $3
      WHERE guild_event_id = $1
        AND management_kind = $2
        AND discoverable = true`,
    [normalizedEventId, managementKind, nowUnix],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function withdrawGuildCalendarEvent(
  eventId: string,
  client: PoolClient | null = null,
): Promise<boolean> {
  return withdrawManagedGuildCalendarEvent(eventId, "application", client);
}

export async function withdrawExternallyManagedGuildCalendarEvent(eventId: string): Promise<boolean> {
  return withdrawManagedGuildCalendarEvent(eventId, "external");
}

async function guildCalendarEventWithManagement(
  eventId: string,
  managementKind?: GuildCalendarManagementKind,
): Promise<GuildCalendarEvent | null> {
  const normalizedEventId = requiredText(eventId, "eventId");
  const values: unknown[] = [normalizedEventId];
  const managementClause = managementKind
    ? (values.push(managementKind), `AND management_kind = $${values.length}`)
    : "";
  const result = await pool.query<GuildCalendarEventRow>(
    `SELECT guild_event_id, occurs_at_start_unix, occurs_at_end_unix,
            guild_event_title, guild_event_destination, guild_event_category,
            registered_at_unix, updated_at_unix
       FROM guild_event_calendar_listings
      WHERE guild_event_id = $1
        AND discoverable = true
        ${managementClause}`,
    values,
  );
  const row = result.rows[0];
  return row ? mapEvent(row) : null;
}

export async function guildCalendarEvent(eventId: string): Promise<GuildCalendarEvent | null> {
  return guildCalendarEventWithManagement(eventId);
}

export async function externallyManagedGuildCalendarEvent(
  eventId: string,
): Promise<GuildCalendarEvent | null> {
  return guildCalendarEventWithManagement(eventId, "external");
}

export async function discoverableGuildCalendarEvents(): Promise<GuildCalendarEvent[]> {
  const result = await pool.query<GuildCalendarEventRow>(
    `SELECT guild_event_id, occurs_at_start_unix, occurs_at_end_unix,
            guild_event_title, guild_event_destination, guild_event_category,
            registered_at_unix, updated_at_unix
       FROM guild_event_calendar_listings
      WHERE discoverable = true
      ORDER BY occurs_at_start_unix ASC, guild_event_id ASC`,
  );
  return result.rows.map(mapEvent);
}
