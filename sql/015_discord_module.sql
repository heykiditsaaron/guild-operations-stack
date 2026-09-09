CREATE TABLE IF NOT EXISTS discord_module_settings (
  guild_id text PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  client_id text,
  client_secret_ciphertext text,
  discord_guild_id text,
  bot_token_ciphertext text,
  invite_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
