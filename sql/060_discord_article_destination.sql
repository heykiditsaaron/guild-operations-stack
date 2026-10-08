-- One optional article publication destination per installation's Discord server.
ALTER TABLE discord_integration_configuration
  ADD COLUMN article_channel_id text NULL;
