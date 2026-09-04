ALTER TABLE raffle_rounds
  ADD COLUMN IF NOT EXISTS updated_by_subject_id uuid REFERENCES guild_subjects(subject_id) ON DELETE RESTRICT;

ALTER TABLE raffle_rounds
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
