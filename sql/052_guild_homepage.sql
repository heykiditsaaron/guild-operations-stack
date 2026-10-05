CREATE TABLE guild_homepage_settings (
  guild_id text PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
  lede text,
  supporting_text text,
  updated_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint)
);

CREATE TABLE guild_homepage_sections (
  section_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  kind text NOT NULL CHECK (kind IN ('cards', 'statement')),
  kicker text,
  heading text,
  body text,
  layout text CHECK (layout IS NULL OR layout IN ('single', 'double', 'triple')),
  UNIQUE (guild_id, position),
  CHECK (
    (kind = 'cards' AND layout IS NOT NULL)
    OR
    (kind = 'statement' AND layout IS NULL)
  )
);

CREATE TABLE guild_homepage_cards (
  card_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section_id bigint NOT NULL REFERENCES guild_homepage_sections(section_id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  title text NOT NULL,
  body text NOT NULL,
  UNIQUE (section_id, position)
);
