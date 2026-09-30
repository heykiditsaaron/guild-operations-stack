CREATE TABLE raffles (
  raffle_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE RESTRICT,
  title text CHECK (title IS NULL OR length(btrim(title)) > 0),
  conclusion text CHECK (conclusion IS NULL OR conclusion IN ('drawn', 'operator_cancelled', 'no_participation')),
  drawing_at_unix bigint NOT NULL CHECK (drawing_at_unix >= 0),
  entry_price_gold bigint NOT NULL CHECK (entry_price_gold > 0),
  prize_kind text NOT NULL,
  winner_percentage smallint,
  prize_description text,
  created_by_guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  created_at_unix bigint NOT NULL CHECK (created_at_unix >= 0),
  updated_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  updated_at_unix bigint CHECK (updated_at_unix IS NULL OR updated_at_unix >= created_at_unix),
  opened_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  opened_at_unix bigint,
  participation_paused_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  participation_paused_at_unix bigint,
  participation_resumed_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  participation_resumed_at_unix bigint,
  concluded_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  concluded_at_unix bigint,
  total_entries integer CHECK (total_entries IS NULL OR total_entries >= 0),
  selected_index integer CHECK (selected_index IS NULL OR selected_index >= 0),
  winning_participation_offer_id uuid,
  CHECK ((prize_kind = 'gold' AND winner_percentage BETWEEN 1 AND 100 AND prize_description IS NULL)
      OR (prize_kind IN ('item', 'other') AND winner_percentage IS NULL AND prize_description IS NOT NULL AND length(btrim(prize_description)) > 0)),
  CHECK ((opened_by_guildie_id IS NULL AND opened_at_unix IS NULL) OR (opened_by_guildie_id IS NOT NULL AND opened_at_unix IS NOT NULL)),
  CHECK ((participation_paused_by_guildie_id IS NULL AND participation_paused_at_unix IS NULL)
      OR (participation_paused_by_guildie_id IS NOT NULL AND participation_paused_at_unix IS NOT NULL AND opened_at_unix IS NOT NULL AND participation_paused_at_unix >= opened_at_unix)),
  CHECK ((participation_resumed_by_guildie_id IS NULL AND participation_resumed_at_unix IS NULL)
      OR (participation_resumed_by_guildie_id IS NOT NULL AND participation_resumed_at_unix IS NOT NULL AND participation_paused_at_unix IS NOT NULL AND participation_resumed_at_unix >= participation_paused_at_unix)),
  CHECK ((conclusion IS NULL AND concluded_by_guildie_id IS NULL AND concluded_at_unix IS NULL)
      OR (conclusion IS NOT NULL AND concluded_by_guildie_id IS NOT NULL AND concluded_at_unix IS NOT NULL)),
  CHECK ((conclusion = 'drawn' AND opened_at_unix IS NOT NULL AND total_entries IS NOT NULL AND total_entries > 0 AND selected_index IS NOT NULL AND winning_participation_offer_id IS NOT NULL)
      OR (conclusion = 'no_participation' AND opened_at_unix IS NOT NULL AND total_entries IS NULL AND selected_index IS NULL AND winning_participation_offer_id IS NULL)
      OR (conclusion = 'operator_cancelled' AND total_entries IS NULL AND selected_index IS NULL AND winning_participation_offer_id IS NULL)
      OR (conclusion IS NULL AND total_entries IS NULL AND selected_index IS NULL AND winning_participation_offer_id IS NULL))
);

CREATE TABLE raffle_claims (
  claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES raffles(raffle_id) ON DELETE RESTRICT,
  participation_offer_id uuid NOT NULL REFERENCES activity_participation_offers(participation_offer_id) ON DELETE RESTRICT,
  promised_gold_value bigint NOT NULL CHECK (promised_gold_value > 0),
  created_at_unix bigint NOT NULL CHECK (created_at_unix >= 0),
  resolution_kind text CHECK (resolution_kind IS NULL OR resolution_kind IN ('approved', 'denied', 'revoked')),
  approved_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  approved_at_unix bigint,
  denied_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  denied_at_unix bigint,
  denial_reason text,
  revoked_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  revoked_at_unix bigint,
  CHECK ((resolution_kind IS NULL AND approved_by_guildie_id IS NULL AND approved_at_unix IS NULL AND denied_by_guildie_id IS NULL AND denied_at_unix IS NULL AND denial_reason IS NULL AND revoked_by_guildie_id IS NULL AND revoked_at_unix IS NULL)
      OR (resolution_kind = 'approved' AND approved_by_guildie_id IS NOT NULL AND approved_at_unix IS NOT NULL AND denied_by_guildie_id IS NULL AND denied_at_unix IS NULL AND denial_reason IS NULL AND revoked_by_guildie_id IS NULL AND revoked_at_unix IS NULL)
      OR (resolution_kind = 'denied' AND approved_by_guildie_id IS NULL AND approved_at_unix IS NULL AND denied_by_guildie_id IS NOT NULL AND denied_at_unix IS NOT NULL AND denial_reason IS NOT NULL AND length(btrim(denial_reason)) > 0 AND revoked_by_guildie_id IS NULL AND revoked_at_unix IS NULL)
      OR (resolution_kind = 'revoked' AND approved_by_guildie_id IS NULL AND approved_at_unix IS NULL AND denied_by_guildie_id IS NULL AND denied_at_unix IS NULL AND denial_reason IS NULL AND revoked_by_guildie_id IS NOT NULL AND revoked_at_unix IS NOT NULL))
);

ALTER TABLE raffles ADD CONSTRAINT raffles_winning_participation_offer_fk
  FOREIGN KEY (winning_participation_offer_id) REFERENCES activity_participation_offers(participation_offer_id) ON DELETE RESTRICT;

CREATE INDEX raffles_guild_conclusion_idx ON raffles(guild_id, conclusion, drawing_at_unix);
CREATE INDEX raffle_claims_raffle_resolution_idx ON raffle_claims(raffle_id, resolution_kind);
CREATE UNIQUE INDEX raffle_claims_participation_offer_idx ON raffle_claims(participation_offer_id);
