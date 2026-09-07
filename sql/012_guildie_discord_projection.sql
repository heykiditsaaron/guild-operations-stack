CREATE TABLE IF NOT EXISTS guild_discord_projection_settings (
  guild_id text PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  linked_role_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guild_discord_rank_roles (
  guild_id text NOT NULL,
  rank_index integer NOT NULL CHECK (rank_index >= 0),
  discord_role_id text NOT NULL CHECK (length(discord_role_id) > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, rank_index),
  FOREIGN KEY (guild_id, rank_index)
    REFERENCES guild_rank_definitions(guild_id, rank_index)
    ON DELETE CASCADE
);

INSERT INTO guild_rank_capabilities (guild_id, rank_index, capability)
SELECT guild_id, rank_index, 'guild.discord.manage'
  FROM guild_rank_definitions
 WHERE rank_index IN (0, 1, 2)
ON CONFLICT (guild_id, rank_index, capability) DO NOTHING;
