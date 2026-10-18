ALTER TABLE discord_raffle_projections
  ADD COLUMN IF NOT EXISTS discord_thread_id text;
