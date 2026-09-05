ALTER TABLE raffle_rounds
  ADD COLUMN IF NOT EXISTS round_title text
    CHECK (round_title IS NULL OR length(btrim(round_title)) > 0);
