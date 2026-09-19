ALTER TABLE raffles
  RENAME COLUMN participation_closed_by_guildie_id TO participation_paused_by_guildie_id;

ALTER TABLE raffles
  RENAME COLUMN participation_closed_at_unix TO participation_paused_at_unix;

ALTER TABLE raffles
  ADD COLUMN participation_resumed_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  ADD COLUMN participation_resumed_at_unix bigint;

ALTER TABLE raffles
  DROP CONSTRAINT IF EXISTS raffles_participation_closure_attribution_check;

ALTER TABLE raffles
  ADD CONSTRAINT raffles_participation_pause_attribution_check
  CHECK (
    (participation_paused_by_guildie_id IS NULL AND participation_paused_at_unix IS NULL)
    OR (
      participation_paused_by_guildie_id IS NOT NULL
      AND participation_paused_at_unix IS NOT NULL
      AND opened_at_unix IS NOT NULL
      AND participation_paused_at_unix >= opened_at_unix
    )
  ),
  ADD CONSTRAINT raffles_participation_resume_attribution_check
  CHECK (
    (participation_resumed_by_guildie_id IS NULL AND participation_resumed_at_unix IS NULL)
    OR (
      participation_resumed_by_guildie_id IS NOT NULL
      AND participation_resumed_at_unix IS NOT NULL
      AND participation_paused_at_unix IS NOT NULL
      AND participation_resumed_at_unix >= participation_paused_at_unix
    )
  );
