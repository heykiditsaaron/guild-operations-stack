import type { PoolClient } from "pg";
import { pool } from "../../db.js";

export type GuildCalendarOccursAt = readonly [number] | readonly [number, number];

export type GuildCalendarPointInput = {
  sourceKind: string;
  sourceSubject: string;
  occursAt: GuildCalendarOccursAt;
};

export type GuildCalendarPoint = {
  sourceKind: string;
  sourceSubject: string;
  occursAt: GuildCalendarOccursAt;
  registeredAtUnix: number;
  updatedAtUnix: number;
};

type GuildCalendarPointRow = {
  source_kind: string;
  source_subject: string;
  occurs_at_start_unix: string;
  occurs_at_end_unix: string | null;
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

function normalizePoint(input: GuildCalendarPointInput): GuildCalendarPointInput {
  const sourceKind = requiredText(input.sourceKind, "sourceKind");
  const sourceSubject = requiredText(input.sourceSubject, "sourceSubject");
  if (input.occursAt.length !== 1 && input.occursAt.length !== 2) {
    throw new Error("occursAt must contain one Unix instant or a start/end Unix range");
  }
  const [start, end] = input.occursAt;
  validateUnix(start, "occursAt[0]");
  if (end !== undefined) {
    validateUnix(end, "occursAt[1]");
    if (end < start) throw new Error("occursAt end must not precede start");
  }
  return { sourceKind, sourceSubject, occursAt: end === undefined ? [start] : [start, end] };
}

function mapPoint(row: GuildCalendarPointRow): GuildCalendarPoint {
  const start = Number(row.occurs_at_start_unix);
  const end = row.occurs_at_end_unix === null ? null : Number(row.occurs_at_end_unix);
  return {
    sourceKind: row.source_kind,
    sourceSubject: row.source_subject,
    occursAt: end === null ? [start] : [start, end],
    registeredAtUnix: Number(row.registered_at_unix),
    updatedAtUnix: Number(row.updated_at_unix),
  };
}

export async function establishGuildCalendarPoint(
  input: GuildCalendarPointInput,
  client: PoolClient | null = null,
): Promise<GuildCalendarPoint> {
  const point = normalizePoint(input);
  const nowUnix = Math.floor(Date.now() / 1000);
  const executor = client ?? pool;
  const [start, end] = point.occursAt;
  const result = await executor.query<GuildCalendarPointRow>(
    `INSERT INTO guild_event_calendar_listings (
       guild_event_id, source_kind, source_subject,
       occurs_at_start_unix, occurs_at_end_unix,
       discoverable, registered_at_unix, updated_at_unix, management_kind
     ) VALUES ($1,$2,$3,$4,$5,true,$6,$6,'application')
     ON CONFLICT (source_kind, source_subject) DO UPDATE
       SET occurs_at_start_unix = EXCLUDED.occurs_at_start_unix,
           occurs_at_end_unix = EXCLUDED.occurs_at_end_unix,
           discoverable = true,
           updated_at_unix = EXCLUDED.updated_at_unix
       WHERE guild_event_calendar_listings.management_kind = 'application'
     RETURNING source_kind, source_subject, occurs_at_start_unix, occurs_at_end_unix,
               registered_at_unix, updated_at_unix`,
    [
      `${point.sourceKind}:${point.sourceSubject}`,
      point.sourceKind,
      point.sourceSubject,
      start,
      end ?? null,
      nowUnix,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("calendar point is managed by a different authority class");
  return mapPoint(row);
}

export async function withdrawGuildCalendarPoint(
  sourceKind: string,
  sourceSubject: string,
  client: PoolClient | null = null,
): Promise<boolean> {
  const normalizedKind = requiredText(sourceKind, "sourceKind");
  const normalizedSubject = requiredText(sourceSubject, "sourceSubject");
  const nowUnix = Math.floor(Date.now() / 1000);
  const executor = client ?? pool;
  const result = await executor.query(
    `UPDATE guild_event_calendar_listings
        SET discoverable = false,
            updated_at_unix = $3
      WHERE source_kind = $1
        AND source_subject = $2
        AND management_kind = 'application'
        AND discoverable = true`,
    [normalizedKind, normalizedSubject, nowUnix],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function guildCalendarPoint(
  sourceKind: string,
  sourceSubject: string,
): Promise<GuildCalendarPoint | null> {
  const normalizedKind = requiredText(sourceKind, "sourceKind");
  const normalizedSubject = requiredText(sourceSubject, "sourceSubject");
  const result = await pool.query<GuildCalendarPointRow>(
    `SELECT source_kind, source_subject, occurs_at_start_unix, occurs_at_end_unix,
            registered_at_unix, updated_at_unix
       FROM guild_event_calendar_listings
      WHERE source_kind = $1
        AND source_subject = $2
        AND discoverable = true`,
    [normalizedKind, normalizedSubject],
  );
  const row = result.rows[0];
  return row ? mapPoint(row) : null;
}

export async function discoverableGuildCalendarPoints(): Promise<GuildCalendarPoint[]> {
  const result = await pool.query<GuildCalendarPointRow>(
    `SELECT source_kind, source_subject, occurs_at_start_unix, occurs_at_end_unix,
            registered_at_unix, updated_at_unix
       FROM guild_event_calendar_listings
      WHERE discoverable = true
        AND management_kind = 'application'
      ORDER BY occurs_at_start_unix ASC, source_kind ASC, source_subject ASC`,
  );
  return result.rows.map(mapPoint);
}
