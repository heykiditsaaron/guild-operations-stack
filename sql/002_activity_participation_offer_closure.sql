ALTER TABLE activity_participation_offers
  ADD COLUMN closed_at_unix bigint;

CREATE INDEX activity_participation_offers_outstanding_idx
  ON activity_participation_offers (party_kind, party_reference, offered_at_unix DESC)
  WHERE revoked_at_unix IS NULL AND closed_at_unix IS NULL;
