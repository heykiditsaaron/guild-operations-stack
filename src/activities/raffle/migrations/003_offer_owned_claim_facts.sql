DROP INDEX IF EXISTS raffle_claims_claimant_guildie_idx;

ALTER TABLE raffle_claims
  DROP COLUMN claimant_guildie_id,
  DROP COLUMN character_record_id,
  DROP COLUMN requested_entry_count;
