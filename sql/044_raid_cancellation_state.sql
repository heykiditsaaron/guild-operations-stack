ALTER TABLE raid_events
  ADD COLUMN IF NOT EXISTS cancelled_at_unix bigint,
  ADD COLUMN IF NOT EXISTS cancelled_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT;

ALTER TABLE raid_events
  DROP CONSTRAINT IF EXISTS raid_events_cancellation_pair_check;

ALTER TABLE raid_events
  ADD CONSTRAINT raid_events_cancellation_pair_check
  CHECK ((cancelled_at_unix IS NULL) = (cancelled_by_guildie_id IS NULL));

CREATE INDEX IF NOT EXISTS raid_events_active_occurs_idx
  ON raid_events(guild_id, occurs_start_unix)
  WHERE cancelled_at_unix IS NULL;
