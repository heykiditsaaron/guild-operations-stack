CREATE TABLE IF NOT EXISTS guild_event_publications (
  publication_id text PRIMARY KEY CHECK (length(btrim(publication_id)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  occurs_at jsonb NOT NULL CHECK (jsonb_typeof(occurs_at) = 'array' AND jsonb_array_length(occurs_at) > 0),
  description text,
  category text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  interactions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(interactions) = 'array'),
  published boolean NOT NULL DEFAULT true,
  published_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  updated_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint)
);

CREATE INDEX IF NOT EXISTS guild_event_publications_published_idx
  ON guild_event_publications(published, updated_at_unix);
