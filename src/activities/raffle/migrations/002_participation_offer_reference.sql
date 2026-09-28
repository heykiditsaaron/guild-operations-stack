ALTER TABLE raffle_claims
  ADD COLUMN participation_offer_id uuid REFERENCES activity_participation_offers(participation_offer_id) ON DELETE RESTRICT;

UPDATE raffle_claims claim
   SET participation_offer_id = offer.participation_offer_id
  FROM activity_participation_offers offer
 WHERE offer.activity_kind = 'raffle'
   AND offer.activity_id = claim.raffle_id::text
   AND offer.procedure_reference = claim.claim_id::text
   AND claim.participation_offer_id IS NULL;

CREATE UNIQUE INDEX raffle_claims_participation_offer_idx
  ON raffle_claims(participation_offer_id)
  WHERE participation_offer_id IS NOT NULL;
