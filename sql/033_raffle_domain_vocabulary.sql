ALTER TABLE raffle_rounds RENAME TO raffles;
ALTER TABLE raffles RENAME COLUMN round_id TO raffle_id;
ALTER TABLE raffles RENAME COLUMN round_title TO title;
ALTER TABLE raffles RENAME COLUMN live_by_guildie_id TO opened_by_guildie_id;
ALTER TABLE raffles RENAME COLUMN live_at_unix TO opened_at_unix;

ALTER TABLE raffle_claims RENAME COLUMN round_id TO raffle_id;
ALTER TABLE raffle_claims RENAME COLUMN cancelled_by_guildie_id TO revoked_by_guildie_id;
ALTER TABLE raffle_claims RENAME COLUMN cancelled_at_unix TO revoked_at_unix;

UPDATE raffle_claims
   SET resolution_kind = 'revoked'
 WHERE resolution_kind = 'cancelled';

ALTER TABLE raffle_claims DROP CONSTRAINT IF EXISTS raffle_claims_resolution_kind_check;
ALTER TABLE raffle_claims
  ADD CONSTRAINT raffle_claims_resolution_kind_check
  CHECK (resolution_kind IS NULL OR resolution_kind IN ('approved', 'denied', 'revoked'));

ALTER INDEX IF EXISTS raffle_rounds_guild_status_idx RENAME TO raffles_guild_status_idx;
ALTER INDEX IF EXISTS raffle_rounds_one_live_per_guild_idx RENAME TO raffles_one_live_per_guild_idx;
ALTER INDEX IF EXISTS raffle_claims_round_resolution_idx RENAME TO raffle_claims_raffle_resolution_idx;
