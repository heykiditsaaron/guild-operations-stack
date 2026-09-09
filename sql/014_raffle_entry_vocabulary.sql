ALTER TABLE raffle_rounds
  RENAME COLUMN ticket_price_gold TO entry_price_gold;

ALTER TABLE raffle_claims
  RENAME COLUMN requested_ticket_count TO requested_entry_count;
