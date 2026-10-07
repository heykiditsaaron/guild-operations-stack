CREATE TABLE discord_integration_configuration (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  enabled boolean NOT NULL DEFAULT false,
  application_id text NOT NULL CHECK (length(btrim(application_id)) > 0),
  public_key text,
  client_secret_ciphertext text NOT NULL CHECK (length(client_secret_ciphertext) > 0),
  bot_token_ciphertext text NOT NULL CHECK (length(bot_token_ciphertext) > 0),
  discord_guild_id text,
  configured_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (public_key IS NULL OR length(btrim(public_key)) > 0),
  CHECK (discord_guild_id IS NULL OR length(btrim(discord_guild_id)) > 0)
);

CREATE TABLE discord_identities (
  identity_id uuid PRIMARY KEY REFERENCES identities(identity_id) ON DELETE RESTRICT,
  discord_user_id text NOT NULL UNIQUE CHECK (length(btrim(discord_user_id)) > 0),
  username text,
  established_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CHECK (username IS NULL OR length(btrim(username)) > 0)
);

CREATE TABLE identity_wow_associations (
  external_identity_id uuid PRIMARY KEY REFERENCES identities(identity_id) ON DELETE RESTRICT,
  wow_identity_id uuid NOT NULL UNIQUE REFERENCES wow_account_identities(identity_id) ON DELETE RESTRICT,
  established_at timestamptz NOT NULL DEFAULT now(),
  CHECK (external_identity_id <> wow_identity_id)
);
