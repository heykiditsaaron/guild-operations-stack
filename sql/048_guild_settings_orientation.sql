ALTER TABLE guild_presentation_settings
  ADD COLUMN IF NOT EXISTS guild_settings_location_acknowledged boolean NOT NULL DEFAULT false;
