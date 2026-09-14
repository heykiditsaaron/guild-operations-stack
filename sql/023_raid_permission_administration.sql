CREATE TABLE IF NOT EXISTS raid_permission_configuration (
  guild_id text PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
  initialized_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint)
);

INSERT INTO guild_rank_capabilities (guild_id, rank_index, capability)
SELECT grd.guild_id, grd.rank_index, defaults.capability
  FROM guild_rank_definitions grd
  JOIN (
    VALUES
      (0, 'raid.create'),
      (1, 'raid.create'),
      (2, 'raid.create'),
      (0, 'raid.manage'),
      (1, 'raid.manage'),
      (2, 'raid.manage'),
      (3, 'raid.manage'),
      (0, 'raid.permissions')
  ) AS defaults(rank_index, capability)
    ON defaults.rank_index = grd.rank_index
 WHERE NOT EXISTS (
   SELECT 1
     FROM raid_permission_configuration rpc
    WHERE rpc.guild_id = grd.guild_id
 )
ON CONFLICT (guild_id, rank_index, capability) DO NOTHING;

INSERT INTO raid_permission_configuration (guild_id)
SELECT DISTINCT guild_id
  FROM guild_rank_definitions
 WHERE rank_index = 0
ON CONFLICT (guild_id) DO NOTHING;
