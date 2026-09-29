ALTER TABLE raffle_claims
  ADD COLUMN participation_offer_id uuid NOT NULL REFERENCES activity_participation_offers(participation_offer_id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX raffle_claims_participation_offer_idx
  ON raffle_claims(participation_offer_id);
