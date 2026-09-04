import type { PoolClient } from "pg";
import { pool } from "../db.js";

export type GuildEventOccursAt = readonly [number] | readonly [number, number];

export type GuildEventRegistrationInput = {
  guildEventId: string;
  guildEventKind: string;
  guildEventOccursAt: GuildEventOccursAt;
  guildEventCategory?: string | null;
};

export type GuildEventRegistration = {
  guildEventId: string;
  guildEventKind: string;
  guildEventOccursAt: GuildEventOccursAt;
  guildEventCategory: string | null;
  discoverable: boolean;
  registeredAtUnix: number;
  updatedAtUnix: number;
};

type GuildEventRegistrationRow = {
  guild_event_id: string;
  guild_event_kind: string;
  occurs_at_start_unix: string;
  occurs_at_end_unix: string | null;
  guild_event_category: string | null;
  discoverable: boolean;
  registered_at_unix: string;
  updated_at_unix: string;
};

function validateUnix(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative Unix timestamp`);
  }
}

function normalizeRegistration(input: GuildEventRegistrationInput): GuildEventRegistrationInput {
  const guildEventId = input.guildEventId.trim();
  if (!guildEventId) throw new Error("guildEventId is required");

  const guildEventKind = input.guildEventKind.trim();
  if (!guildEventKind) throw new Error("guildEventKind is required");

  if (input.guildEventOccursAt.length !== 1 && input.guildEventOccursAt.length !== 2) {
    throw new Error("guildEventOccursAt must contain one Unix instant or a start/end Unix range");
  }

  const [start, end] = input.guildEventOccursAt;
  validateUnix(start, "guildEventOccursAt[0]");
  if (end !== undefined) {
    validateUnix(end, "guildEventOccursAt[1]");
    if (end < start) throw new Error("guildEventOccursAt end must not precede start");
  }

  const category = input.guildEventCategory?.trim() || null;
  return {
    guildEventId,
    guildEventKind,
    guildEventOccursAt: end === undefined ? [start] : [start, end],
    guildEventCategory: category,
  };
}

function mapRegistration(row: GuildEventRegistrationRow): GuildEventRegistration {
  const start = Number(row.occurs_at_start_unix);
  const end = row.occurs_at_end_unix === null ? null : Number(row.occurs_at_end_unix);
  return {
    guildEventId: row.guild_event_id,
    guildEventKind: row.guild_event_kind,
    guildEventOccursAt: end === null ? [start] : [start, end],
    guildEventCategory: row.guild_event_category,
    discoverable: row.discoverable,
    registeredAtUnix: Number(row.registered_at_unix),
    updatedAtUnix: Number(row.updated_at_unix),
  };
}

export async function establishGuildEventRegistration(
  input: GuildEventRegistrationInput,
  client: PoolClient | null = null,
): Promise<void> {
  const registration = normalizeRegistration(input);
  const nowUnix = Math.floor(Date.now() / 1000);
  const executor = client ?? pool;
  const [start, end] = registration.guildEventOccursAt;

  await executor.query(
    `INSERT INTO guild_event_registrations (
       guild_event_id, guild_event_kind,
       occurs_at_start_unix, occurs_at_end_unix,
       guild_event_category, discoverable,
       registered_at_unix, updated_at_unix
     ) VALUES ($1,$2,$3,$4,$5,true,$6,$6)
     ON CONFLICT (guild_event_id) DO UPDATE
       SET guild_event_kind = EXCLUDED.guild_event_kind,
           occurs_at_start_unix = EXCLUDED.occurs_at_start_unix,
           occurs_at_end_unix = EXCLUDED.occurs_at_end_unix,
           guild_event_category = EXCLUDED.guild_event_category,
           discoverable = true,
           updated_at_unix = EXCLUDED.updated_at_unix`,
    [
      registration.guildEventId,
      registration.guildEventKind,
      start,
      end ?? null,
      registration.guildEventCategory ?? null,
      nowUnix,
    ],
  );
}

export async function withdrawGuildEventRegistration(
  guildEventId: string,
  client: PoolClient | null = null,
): Promise<void> {
  const nowUnix = Math.floor(Date.now() / 1000);
  const executor = client ?? pool;
  await executor.query(
    `UPDATE guild_event_registrations
        SET discoverable = false,
            updated_at_unix = $2
      WHERE guild_event_id = $1`,
    [guildEventId, nowUnix],
  );
}

export async function guildEventRegistration(
  guildEventId: string,
): Promise<GuildEventRegistration | null> {
  const result = await pool.query<GuildEventRegistrationRow>(
    `SELECT *
       FROM guild_event_registrations
      WHERE guild_event_id = $1`,
    [guildEventId],
  );
  const row = result.rows[0];
  return row ? mapRegistration(row) : null;
}

export async function discoverableGuildEventRegistrations(): Promise<GuildEventRegistration[]> {
  const result = await pool.query<GuildEventRegistrationRow>(
    `SELECT *
       FROM guild_event_registrations
      WHERE discoverable = true
      ORDER BY occurs_at_start_unix ASC, guild_event_id ASC`,
  );
  return result.rows.map(mapRegistration);
}
