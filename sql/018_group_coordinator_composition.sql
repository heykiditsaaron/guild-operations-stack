ALTER TABLE coordination_opportunities
  ADD COLUMN IF NOT EXISTS removed_at_unix bigint
  CHECK (removed_at_unix IS NULL OR removed_at_unix >= created_at_unix);

CREATE INDEX IF NOT EXISTS coordination_opportunities_active_coordination_idx
  ON coordination_opportunities(coordination_id, created_at_unix)
  WHERE removed_at_unix IS NULL;
