ALTER TABLE raffles
  ADD COLUMN participation_closed_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  ADD COLUMN participation_closed_at_unix bigint;

UPDATE raffles
   SET participation_closed_at_unix = concluded_at_unix,
       participation_closed_by_guildie_id = concluded_by_guildie_id
 WHERE status = 'concluded'
   AND opened_at_unix IS NOT NULL;

DROP INDEX IF EXISTS raffles_one_live_per_guild_idx;
DROP INDEX IF EXISTS raffles_guild_status_idx;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'raffles'::regclass
       AND contype = 'c'
       AND (
         pg_get_constraintdef(oid) LIKE '%status%'
         OR pg_get_constraintdef(oid) LIKE '%live_%'
       )
  LOOP
    EXECUTE format('ALTER TABLE raffles DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE raffles DROP COLUMN status;

ALTER TABLE raffles
  ADD CONSTRAINT raffles_conclusion_check
  CHECK (conclusion IS NULL OR conclusion IN ('drawn', 'operator_cancelled', 'no_participation')),
  ADD CONSTRAINT raffles_opening_attribution_check
  CHECK (
    (opened_by_guildie_id IS NULL AND opened_at_unix IS NULL)
    OR (opened_by_guildie_id IS NOT NULL AND opened_at_unix IS NOT NULL)
  ),
  ADD CONSTRAINT raffles_participation_closure_attribution_check
  CHECK (
    (participation_closed_by_guildie_id IS NULL AND participation_closed_at_unix IS NULL)
    OR (
      participation_closed_by_guildie_id IS NOT NULL
      AND participation_closed_at_unix IS NOT NULL
      AND opened_at_unix IS NOT NULL
      AND participation_closed_at_unix >= opened_at_unix
    )
  ),
  ADD CONSTRAINT raffles_conclusion_attribution_check
  CHECK (
    (conclusion IS NULL AND concluded_by_guildie_id IS NULL AND concluded_at_unix IS NULL)
    OR (conclusion IS NOT NULL AND concluded_by_guildie_id IS NOT NULL AND concluded_at_unix IS NOT NULL)
  ),
  ADD CONSTRAINT raffles_draw_result_check
  CHECK (
    (conclusion = 'drawn'
      AND opened_at_unix IS NOT NULL
      AND total_entries IS NOT NULL AND total_entries > 0
      AND selected_index IS NOT NULL AND winning_claim_id IS NOT NULL)
    OR
    (conclusion = 'no_participation'
      AND opened_at_unix IS NOT NULL
      AND total_entries IS NULL AND selected_index IS NULL AND winning_claim_id IS NULL)
    OR
    (conclusion = 'operator_cancelled'
      AND total_entries IS NULL AND selected_index IS NULL AND winning_claim_id IS NULL)
    OR
    (conclusion IS NULL
      AND concluded_by_guildie_id IS NULL AND concluded_at_unix IS NULL
      AND total_entries IS NULL AND selected_index IS NULL AND winning_claim_id IS NULL)
  );

CREATE INDEX raffles_guild_conclusion_idx
  ON raffles(guild_id, conclusion, drawing_at_unix);
