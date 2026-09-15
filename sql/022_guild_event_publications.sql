CREATE TABLE IF NOT EXISTS guild_event_publications (
  publication_id text PRIMARY KEY CHECK (length(btrim(publication_id)) > 0),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text,
  occurs_start_unix bigint NOT NULL CHECK (occurs_start_unix > 0),
  occurs_end_unix bigint,
  category text NOT NULL CHECK (length(btrim(category)) > 0),
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  interactions jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT true,
  published_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  updated_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  CHECK (occurs_end_unix IS NULL OR occurs_end_unix >= occurs_start_unix),
  CHECK (jsonb_typeof(interactions) = 'array')
);

CREATE INDEX IF NOT EXISTS guild_event_publications_occurs_idx
  ON guild_event_publications(published, occurs_start_unix);
