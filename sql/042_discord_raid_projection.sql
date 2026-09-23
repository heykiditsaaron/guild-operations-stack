CREATE TABLE IF NOT EXISTS discord_raid_projection_settings (
  guild_id text PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
  channel_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discord_raid_projections (
  raid_id uuid PRIMARY KEY,
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  discord_channel_id text NOT NULL,
  discord_message_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (discord_channel_id, discord_message_id)
);

CREATE INDEX IF NOT EXISTS discord_raid_projections_guild_idx
  ON discord_raid_projections(guild_id);
