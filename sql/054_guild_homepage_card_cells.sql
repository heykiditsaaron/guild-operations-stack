ALTER TABLE guild_homepage_primitives
  ADD COLUMN layout text,
  ADD COLUMN text_cells jsonb;

UPDATE guild_homepage_primitives
SET
  layout = CASE width WHEN 'half' THEN 'double' WHEN 'third' THEN 'triple' ELSE 'single' END,
  text_cells = jsonb_build_array(body);

ALTER TABLE guild_homepage_primitives
  ALTER COLUMN layout SET NOT NULL,
  ALTER COLUMN text_cells SET NOT NULL,
  ADD CONSTRAINT guild_homepage_primitives_layout_check CHECK (layout IN ('single', 'double', 'triple'));

ALTER TABLE guild_homepage_primitives DROP COLUMN width;
