INSERT INTO guild_rank_capabilities (guild_id, rank_index, capability)
SELECT guild_id, rank_index, 'raid.manage'
  FROM guild_rank_definitions
 WHERE rank_index IN (0, 1, 2, 3)
ON CONFLICT (guild_id, rank_index, capability) DO NOTHING;
