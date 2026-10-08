-- External Discord message coordinates are projection receipts, not article authority.
CREATE TABLE discord_article_projections (
  article_id text PRIMARY KEY,
  discord_channel_id text NOT NULL,
  discord_message_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
