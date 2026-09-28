ALTER TABLE activity_participation_offers
  ADD COLUMN components jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE activity_participation_offers
  ADD CONSTRAINT activity_participation_offer_components_array
  CHECK (jsonb_typeof(components) = 'array');
