import { config } from "../../config.js";
import { pool } from "../../db.js";

export const GUILD_REFRESH_MINIMUM_INTERVAL_SECONDS = 300;
export const GUILD_REFRESH_DEFAULT_INTERVAL_SECONDS = 86400;

export type GuildRefreshSchedule = {
  enabled: boolean;
  intervalSeconds: number;
  nextDueAtUnix: number | null;
};

export class InvalidGuildRefreshIntervalError extends Error {
  constructor(public readonly minimumIntervalSeconds = GUILD_REFRESH_MINIMUM_INTERVAL_SECONDS) {
    super(`Guild refresh interval must be an integer of at least ${minimumIntervalSeconds} seconds`);
    this.name = "InvalidGuildRefreshIntervalError";
  }
}

export async function guildRefreshSchedule(): Promise<GuildRefreshSchedule> {
  const result = await pool.query<{
    enabled: boolean;
    interval_seconds: number;
    next_due_at_unix: string | null;
  }>(
    `SELECT enabled, interval_seconds, next_due_at_unix
       FROM guild_refresh_schedule
      WHERE guild_id = $1`,
    [config.guild.id],
  );

  const row = result.rows[0];
  if (!row) {
    return {
      enabled: false,
      intervalSeconds: GUILD_REFRESH_DEFAULT_INTERVAL_SECONDS,
      nextDueAtUnix: null,
    };
  }

  return {
    enabled: row.enabled,
    intervalSeconds: row.interval_seconds,
    nextDueAtUnix: row.next_due_at_unix === null ? null : Number(row.next_due_at_unix),
  };
}

export async function configureGuildRefreshSchedule(input: {
  enabled: boolean;
  intervalSeconds: number;
}): Promise<GuildRefreshSchedule> {
  if (!Number.isInteger(input.intervalSeconds) || input.intervalSeconds < GUILD_REFRESH_MINIMUM_INTERVAL_SECONDS) {
    throw new InvalidGuildRefreshIntervalError();
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const nextDueAtUnix = input.enabled ? nowUnix + input.intervalSeconds : null;

  const result = await pool.query<{
    enabled: boolean;
    interval_seconds: number;
    next_due_at_unix: string | null;
  }>(
    `INSERT INTO guild_refresh_schedule (guild_id, enabled, interval_seconds, next_due_at_unix)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (guild_id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       interval_seconds = EXCLUDED.interval_seconds,
       next_due_at_unix = EXCLUDED.next_due_at_unix
     RETURNING enabled, interval_seconds, next_due_at_unix`,
    [config.guild.id, input.enabled, input.intervalSeconds, nextDueAtUnix],
  );

  const row = result.rows[0];
  if (!row) throw new Error("Guild refresh schedule update did not return persisted state");

  return {
    enabled: row.enabled,
    intervalSeconds: row.interval_seconds,
    nextDueAtUnix: row.next_due_at_unix === null ? null : Number(row.next_due_at_unix),
  };
}

export async function claimDueGuildRefresh(nowUnix = Math.floor(Date.now() / 1000)): Promise<GuildRefreshSchedule | null> {
  const result = await pool.query<{
    enabled: boolean;
    interval_seconds: number;
    next_due_at_unix: string;
  }>(
    `UPDATE guild_refresh_schedule
        SET next_due_at_unix = $2 + interval_seconds
      WHERE guild_id = $1
        AND enabled = true
        AND next_due_at_unix <= $2
      RETURNING enabled, interval_seconds, next_due_at_unix`,
    [config.guild.id, nowUnix],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    enabled: row.enabled,
    intervalSeconds: row.interval_seconds,
    nextDueAtUnix: Number(row.next_due_at_unix),
  };
}
