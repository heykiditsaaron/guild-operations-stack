CREATE TABLE installation_guild_rebindings (
  rebind_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  previous_guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE RESTRICT,
  destination_guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE RESTRICT,
  authorized_by_identity_id uuid NOT NULL REFERENCES identities(identity_id) ON DELETE RESTRICT,
  authorized_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  CHECK (authorized_at_unix >= 0)
);
