INSERT INTO guild_rank_capabilities (guild_id, rank_index, capability)
SELECT guild_id, rank_index, 'guild.refresh.schedule.configure'
  FROM guild_rank_definitions
 WHERE active = true
   AND rank_index IN (0, 1, 2)
ON CONFLICT (guild_id, rank_index, capability) DO NOTHING;
