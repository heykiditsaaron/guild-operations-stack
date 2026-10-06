ALTER TABLE guild_homepage_primitives
  DROP CONSTRAINT guild_homepage_primitives_kind_check;

ALTER TABLE guild_homepage_primitives
  ADD CONSTRAINT guild_homepage_primitives_kind_check
  CHECK (kind IN ('card', 'statement', 'articles'));
