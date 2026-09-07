CREATE TABLE IF NOT EXISTS guild_refresh_schedule (
  guild_id text PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  interval_seconds integer NOT NULL DEFAULT 86400 CHECK (interval_seconds >= 300),
  next_due_at_unix bigint,
  CHECK (next_due_at_unix IS NULL OR next_due_at_unix >= 0),
  CHECK ((enabled = true AND next_due_at_unix IS NOT NULL) OR (enabled = false AND next_due_at_unix IS NULL))
);
