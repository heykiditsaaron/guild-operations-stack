CREATE TABLE IF NOT EXISTS raid_signup_denials (
  raid_id uuid NOT NULL REFERENCES raid_events(raid_id) ON DELETE CASCADE,
  signup_row_id uuid NOT NULL REFERENCES raid_signup_rows(signup_row_id) ON DELETE CASCADE,
  denied_by_guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  denied_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  PRIMARY KEY (raid_id, signup_row_id)
);

ALTER TABLE raid_action_history
  DROP CONSTRAINT IF EXISTS raid_action_history_action_check;

ALTER TABLE raid_action_history
  ADD CONSTRAINT raid_action_history_action_check
  CHECK (action IN ('created', 'modified', 'assignment_established', 'assignment_modified', 'assignment_withdrawn', 'signup_denied')) NOT VALID;
