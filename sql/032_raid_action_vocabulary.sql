ALTER TABLE raid_action_history
  DROP CONSTRAINT IF EXISTS raid_action_history_action_check;

ALTER TABLE raid_action_history
  ADD CONSTRAINT raid_action_history_action_check
  CHECK (action IN ('created', 'modified', 'assigned', 'unassigned')) NOT VALID;
