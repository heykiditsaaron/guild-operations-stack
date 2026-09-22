CREATE TABLE emission_publications (
  publication_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_id text NOT NULL CHECK (length(btrim(transport_id)) > 0),
  code text NOT NULL CHECK (length(btrim(code)) > 0),
  parent text CHECK (parent IS NULL OR length(btrim(parent)) > 0),
  subject text NOT NULL CHECK (length(btrim(subject)) > 0),
  published_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint)
);

CREATE INDEX emission_publications_published_at_idx
  ON emission_publications(published_at_unix, publication_id);
