-- External Participation Offer actors have no native identity row.
-- Ownership remains on the Participation Offer; the native attribution column
-- is retained for historical and native revocations.
DO $$
DECLARE existing_constraint text;
BEGIN
  SELECT conname INTO existing_constraint
    FROM pg_constraint
   WHERE conrelid = 'raffle_claims'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%revoked_by_identity_id%'
     AND pg_get_constraintdef(oid) LIKE '%resolution_kind%';
  IF existing_constraint IS NULL THEN
    RAISE EXCEPTION 'Expected raffle claim resolution constraint not found';
  END IF;
  EXECUTE format('ALTER TABLE raffle_claims DROP CONSTRAINT %I', existing_constraint);
END $$;

ALTER TABLE raffle_claims ADD CONSTRAINT raffle_claims_resolution_consistency CHECK (
  (resolution_kind IS NULL AND approved_by_identity_id IS NULL AND approved_at_unix IS NULL AND denied_by_identity_id IS NULL AND denied_at_unix IS NULL AND denial_reason IS NULL AND revoked_by_identity_id IS NULL AND revoked_at_unix IS NULL)
  OR (resolution_kind = 'approved' AND approved_by_identity_id IS NOT NULL AND approved_at_unix IS NOT NULL AND denied_by_identity_id IS NULL AND denied_at_unix IS NULL AND denial_reason IS NULL AND revoked_by_identity_id IS NULL AND revoked_at_unix IS NULL)
  OR (resolution_kind = 'denied' AND approved_by_identity_id IS NULL AND approved_at_unix IS NULL AND denied_by_identity_id IS NOT NULL AND denied_at_unix IS NOT NULL AND denial_reason IS NOT NULL AND length(btrim(denial_reason)) > 0 AND revoked_by_identity_id IS NULL AND revoked_at_unix IS NULL)
  OR (resolution_kind = 'revoked' AND approved_by_identity_id IS NULL AND approved_at_unix IS NULL AND denied_by_identity_id IS NULL AND denied_at_unix IS NULL AND denial_reason IS NULL AND revoked_at_unix IS NOT NULL)
);
