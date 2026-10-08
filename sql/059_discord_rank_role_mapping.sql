-- Optional customer-configured Discord rank projections.
CREATE TABLE discord_rank_role_mappings (
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  rank_index integer NOT NULL,
  discord_role_id text NOT NULL CHECK (length(btrim(discord_role_id)) > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, rank_index),
  UNIQUE (guild_id, discord_role_id),
  FOREIGN KEY (guild_id, rank_index) REFERENCES guild_rank_definitions(guild_id, rank_index)
);

-- Remember roles previously managed by this feature so mapping changes can
-- remove stale grants without ever touching unrelated Discord roles.
CREATE TABLE discord_rank_role_managed (
  discord_guild_id text NOT NULL,
  discord_role_id text NOT NULL,
  PRIMARY KEY (discord_guild_id, discord_role_id)
);
