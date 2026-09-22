CREATE TABLE emission_consumer_receipts (
  publication_id uuid NOT NULL REFERENCES emission_publications(publication_id) ON DELETE CASCADE,
  consumer_id text NOT NULL CHECK (length(btrim(consumer_id)) > 0),
  acknowledged_at_unix bigint,
  last_attempted_at_unix bigint,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  PRIMARY KEY (publication_id, consumer_id)
);

CREATE INDEX emission_consumer_receipts_pending_idx
  ON emission_consumer_receipts(publication_id, consumer_id)
  WHERE acknowledged_at_unix IS NULL;
