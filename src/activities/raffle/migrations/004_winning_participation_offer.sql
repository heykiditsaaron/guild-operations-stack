ALTER TABLE raffles
  RENAME COLUMN winning_claim_id TO winning_participation_offer_id;

ALTER TABLE raffles
  DROP CONSTRAINT raffles_winning_claim_fk;

UPDATE raffles r
   SET winning_participation_offer_id = rc.participation_offer_id
  FROM raffle_claims rc
 WHERE r.winning_participation_offer_id = rc.claim_id;

ALTER TABLE raffles
  ADD CONSTRAINT raffles_winning_participation_offer_fk
  FOREIGN KEY (winning_participation_offer_id)
  REFERENCES activity_participation_offers(participation_offer_id)
  ON DELETE RESTRICT;
