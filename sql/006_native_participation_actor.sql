UPDATE activity_participation_offers
   SET party_kind = 'native'
 WHERE party_kind = 'guildie';

UPDATE activity_participations
   SET party_kind = 'native'
 WHERE party_kind = 'guildie';

ALTER TABLE activity_participation_offers
  DROP CONSTRAINT activity_participation_offers_party_kind_check;
ALTER TABLE activity_participation_offers
  ADD CONSTRAINT activity_participation_offers_party_kind_check
  CHECK (party_kind IN ('native', 'external'));

ALTER TABLE activity_participations
  DROP CONSTRAINT activity_participations_party_kind_check;
ALTER TABLE activity_participations
  ADD CONSTRAINT activity_participations_party_kind_check
  CHECK (party_kind IN ('native', 'external'));
