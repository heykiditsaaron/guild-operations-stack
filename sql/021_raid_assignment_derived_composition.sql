ALTER TABLE raid_events
  ADD COLUMN IF NOT EXISTS difficulty text;

UPDATE raid_events
   SET difficulty = 'normal'
 WHERE difficulty IS NULL;

ALTER TABLE raid_events
  ALTER COLUMN difficulty SET NOT NULL;

ALTER TABLE raid_events
  DROP CONSTRAINT IF EXISTS raid_events_difficulty_check;

ALTER TABLE raid_events
  ADD CONSTRAINT raid_events_difficulty_check
  CHECK (difficulty IN ('normal', 'heroic', 'mythic'));

ALTER TABLE raid_events
  DROP COLUMN IF EXISTS raid_size;

ALTER TABLE raid_assignments
  DROP COLUMN IF EXISTS slot_index;
