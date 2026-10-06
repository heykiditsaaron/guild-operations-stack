CREATE TABLE guild_articles (
  article_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  author_identity_id uuid NOT NULL REFERENCES identities(identity_id),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  published_at_unix bigint,
  created_at_unix bigint NOT NULL DEFAULT extract(epoch FROM now())::bigint,
  updated_at_unix bigint NOT NULL DEFAULT extract(epoch FROM now())::bigint,
  CHECK (published_at_unix IS NULL OR published_at_unix >= created_at_unix)
);

CREATE INDEX guild_articles_published_idx
  ON guild_articles (guild_id, published_at_unix DESC, article_id)
  WHERE published_at_unix IS NOT NULL;

CREATE INDEX guild_articles_author_idx
  ON guild_articles (guild_id, author_identity_id, updated_at_unix DESC, article_id);
