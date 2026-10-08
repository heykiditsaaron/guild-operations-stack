-- Optional raid destination, independent of article publication and preview.
ALTER TABLE discord_integration_configuration
  ADD COLUMN raid_channel_id text NULL;
