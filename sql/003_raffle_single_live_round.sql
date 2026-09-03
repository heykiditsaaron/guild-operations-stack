CREATE UNIQUE INDEX IF NOT EXISTS raffle_rounds_one_live_per_guild_idx
  ON raffle_rounds(guild_id)
  WHERE status = 'live';
