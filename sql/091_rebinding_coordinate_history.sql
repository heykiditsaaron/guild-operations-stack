ALTER TABLE installation_guild_rebindings
  ADD COLUMN previous_guild_name text,
  ADD COLUMN previous_realm_slug text,
  ADD COLUMN previous_region text,
  ADD COLUMN destination_guild_name text,
  ADD COLUMN destination_realm_slug text,
  ADD COLUMN destination_region text;
