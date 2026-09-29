DROP INDEX IF EXISTS raffle_claims_claimant_guildie_idx;

ALTER TABLE raffle_claims
  DROP COLUMN IF EXISTS claimant_guildie_id,
  DROP COLUMN IF EXISTS character_record_id,
  DROP COLUMN IF EXISTS requested_entry_count;
