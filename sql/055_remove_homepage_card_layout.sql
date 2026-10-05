ALTER TABLE guild_homepage_primitives
  DROP CONSTRAINT IF EXISTS guild_homepage_primitives_layout_check;

ALTER TABLE guild_homepage_primitives
  DROP COLUMN layout;
