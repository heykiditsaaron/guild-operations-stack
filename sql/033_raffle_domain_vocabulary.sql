ALTER TABLE raffle_rounds RENAME TO raffles;
ALTER TABLE raffles RENAME COLUMN round_id TO raffle_id;
ALTER TABLE raffles RENAME COLUMN round_title TO title;
ALTER TABLE raffles RENAME COLUMN live_by_guildie_id TO opened_by_guildie_id;
ALTER TABLE raffles RENAME COLUMN live_at_unix TO opened_at_unix;

ALTER TABLE raffle_claims RENAME COLUMN round_id TO raffle_id;
ALTER TABLE raffle_claims RENAME COLUMN cancelled_by_guildie_id TO revoked_by_guildie_id;
ALTER TABLE raffle_claims RENAME COLUMN cancelled_at_unix TO revoked_at_unix;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'raffle_claims'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%resolution_kind%'
  LOOP
    EXECUTE format('ALTER TABLE raffle_claims DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

UPDATE raffle_claims
   SET resolution_kind = 'revoked'
 WHERE resolution_kind = 'cancelled';

ALTER TABLE raffle_claims
  ADD CONSTRAINT raffle_claims_resolution_kind_check
  CHECK (resolution_kind IS NULL OR resolution_kind IN ('approved', 'denied', 'revoked')),
  ADD CONSTRAINT raffle_claims_resolution_shape_check
  CHECK (
    (resolution_kind IS NULL
      AND approved_by_guildie_id IS NULL AND approved_at_unix IS NULL
      AND denied_by_guildie_id IS NULL AND denied_at_unix IS NULL AND denial_reason IS NULL
      AND revoked_by_guildie_id IS NULL AND revoked_at_unix IS NULL)
    OR
    (resolution_kind = 'approved'
      AND approved_by_guildie_id IS NOT NULL AND approved_at_unix IS NOT NULL
      AND denied_by_guildie_id IS NULL AND denied_at_unix IS NULL AND denial_reason IS NULL
      AND revoked_by_guildie_id IS NULL AND revoked_at_unix IS NULL)
    OR
    (resolution_kind = 'denied'
      AND approved_by_guildie_id IS NULL AND approved_at_unix IS NULL
      AND denied_by_guildie_id IS NOT NULL AND denied_at_unix IS NOT NULL
      AND denial_reason IS NOT NULL AND length(btrim(denial_reason)) > 0
      AND revoked_by_guildie_id IS NULL AND revoked_at_unix IS NULL)
    OR
    (resolution_kind = 'revoked'
      AND approved_by_guildie_id IS NULL AND approved_at_unix IS NULL
      AND denied_by_guildie_id IS NULL AND denied_at_unix IS NULL AND denial_reason IS NULL
      AND revoked_by_guildie_id IS NOT NULL AND revoked_at_unix IS NOT NULL)
  );

ALTER INDEX IF EXISTS raffle_rounds_guild_status_idx RENAME TO raffles_guild_status_idx;
ALTER INDEX IF EXISTS raffle_rounds_one_live_per_guild_idx RENAME TO raffles_one_live_per_guild_idx;
ALTER INDEX IF EXISTS raffle_claims_round_resolution_idx RENAME TO raffle_claims_raffle_resolution_idx;
