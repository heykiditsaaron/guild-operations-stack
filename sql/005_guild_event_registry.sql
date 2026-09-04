CREATE TABLE IF NOT EXISTS guild_event_registrations (
  guild_event_id text PRIMARY KEY CHECK (length(btrim(guild_event_id)) > 0),
  guild_event_kind text NOT NULL CHECK (length(btrim(guild_event_kind)) > 0),
  occurs_at_start_unix bigint NOT NULL CHECK (occurs_at_start_unix >= 0),
  occurs_at_end_unix bigint CHECK (occurs_at_end_unix IS NULL OR occurs_at_end_unix >= occurs_at_start_unix),
  guild_event_category text CHECK (guild_event_category IS NULL OR length(btrim(guild_event_category)) > 0),
  discoverable boolean NOT NULL DEFAULT true,
  registered_at_unix bigint NOT NULL CHECK (registered_at_unix >= 0),
  updated_at_unix bigint NOT NULL CHECK (updated_at_unix >= registered_at_unix)
);

CREATE INDEX IF NOT EXISTS guild_event_registrations_discoverable_occurs_idx
  ON guild_event_registrations(discoverable, occurs_at_start_unix);
