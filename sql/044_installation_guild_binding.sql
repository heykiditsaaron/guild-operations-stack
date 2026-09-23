CREATE TABLE installation_guild_binding (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE RESTRICT,
  bound_at timestamptz NOT NULL DEFAULT now(),
  bound_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  authorized_at timestamptz,
  authorized_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  authorization_kind text CHECK (
    authorization_kind IS NULL OR authorization_kind IN ('guild_master', 'original_install_bypass')
  ),
  CHECK (
    (authorized_at IS NULL AND authorized_by_guildie_id IS NULL AND authorization_kind IS NULL)
    OR
    (authorized_at IS NOT NULL AND authorized_by_guildie_id IS NOT NULL AND authorization_kind IS NOT NULL)
  )
);
