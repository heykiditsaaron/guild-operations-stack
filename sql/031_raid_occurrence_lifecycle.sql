ALTER TABLE raid_events
  DROP CONSTRAINT IF EXISTS raid_events_cancellation_pair_check;

ALTER TABLE raid_events
  DROP COLUMN IF EXISTS signups_open,
  DROP COLUMN IF EXISTS cancelled_at_unix,
  DROP COLUMN IF EXISTS cancelled_by_guildie_id;
