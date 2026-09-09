DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'raffle_rounds'
       AND column_name = 'ticket_price_gold'
  ) AND NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'raffle_rounds'
       AND column_name = 'entry_price_gold'
  ) THEN
    ALTER TABLE raffle_rounds
      RENAME COLUMN ticket_price_gold TO entry_price_gold;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'raffle_claims'
       AND column_name = 'requested_ticket_count'
  ) AND NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'raffle_claims'
       AND column_name = 'requested_entry_count'
  ) THEN
    ALTER TABLE raffle_claims
      RENAME COLUMN requested_ticket_count TO requested_entry_count;
  END IF;
END $$;
