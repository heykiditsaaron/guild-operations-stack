ALTER TABLE raffle_rounds
  ADD COLUMN IF NOT EXISTS updated_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT;

ALTER TABLE raffle_rounds
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
