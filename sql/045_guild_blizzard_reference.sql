ALTER TABLE guilds
  ADD COLUMN blizzard_reference_href text;

COMMENT ON COLUMN guilds.blizzard_reference_href IS
  'Canonical Blizzard guild API reference used as the durable transport locator for refresh operations.';
