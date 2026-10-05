CREATE TABLE guild_homepage_primitives (
  primitive_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  kind text NOT NULL CHECK (kind IN ('card', 'statement')),
  width text NOT NULL CHECK (width IN ('full', 'half', 'third')),
  kicker text,
  heading text,
  body text NOT NULL,
  UNIQUE (guild_id, position)
);

INSERT INTO guild_homepage_primitives (guild_id, position, kind, width, kicker, heading, body)
SELECT
  s.guild_id,
  row_number() OVER (PARTITION BY s.guild_id ORDER BY s.position, COALESCE(c.position, 0)) - 1,
  CASE WHEN s.kind = 'statement' THEN 'statement' ELSE 'card' END,
  CASE
    WHEN s.kind = 'statement' THEN 'full'
    WHEN s.layout = 'double' THEN 'half'
    WHEN s.layout = 'triple' THEN 'third'
    ELSE 'full'
  END,
  CASE WHEN s.kind = 'statement' OR COALESCE(c.position, 0) = 0 THEN s.kicker ELSE NULL END,
  CASE WHEN s.kind = 'statement' THEN s.heading ELSE c.title END,
  CASE WHEN s.kind = 'statement' THEN COALESCE(s.body, '') ELSE COALESCE(c.body, '') END
FROM guild_homepage_sections s
LEFT JOIN guild_homepage_cards c ON c.section_id = s.section_id
ORDER BY s.guild_id, s.position, c.position;

DROP TABLE guild_homepage_cards;
DROP TABLE guild_homepage_sections;
