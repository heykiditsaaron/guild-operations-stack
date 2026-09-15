ALTER TABLE raid_signup_rows
  ADD COLUMN IF NOT EXISTS withdrawn_at_unix bigint;

CREATE INDEX IF NOT EXISTS raid_signup_rows_active_idx
  ON raid_signup_rows (raid_id, applicant_id)
  WHERE withdrawn_at_unix IS NULL;
