ALTER TABLE raid_events
  ADD COLUMN IF NOT EXISTS cancelled_at_unix bigint,
  ADD COLUMN IF NOT EXISTS cancelled_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT;

ALTER TABLE raid_events
  DROP CONSTRAINT IF EXISTS raid_events_cancellation_pair_check;

ALTER TABLE raid_events
  ADD CONSTRAINT raid_events_cancellation_pair_check
  CHECK ((cancelled_at_unix IS NULL) = (cancelled_by_guildie_id IS NULL));

CREATE TABLE IF NOT EXISTS raid_requirements (
  raid_id uuid NOT NULL REFERENCES raid_events(raid_id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  value text NOT NULL CHECK (length(btrim(value)) > 0),
  PRIMARY KEY (raid_id, position)
);

CREATE TABLE IF NOT EXISTS raid_action_history (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id uuid NOT NULL REFERENCES raid_events(raid_id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created', 'modified', 'signups_opened', 'signups_closed', 'cancelled', 'assigned', 'unassigned')),
  actor_guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  occurred_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint)
);

CREATE INDEX IF NOT EXISTS raid_action_history_raid_idx
  ON raid_action_history(raid_id, occurred_at_unix, action_id);
