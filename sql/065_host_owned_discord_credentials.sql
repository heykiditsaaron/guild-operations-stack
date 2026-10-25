-- Discord application credentials belong to the host, not application persistence.
-- Keep the application identity and verified metadata to protect guild-owned settings.
ALTER TABLE discord_integration_configuration
  DROP COLUMN client_secret_ciphertext,
  DROP COLUMN bot_token_ciphertext;
