CREATE TABLE IF NOT EXISTS raffle_rounds (
  round_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'listed',
  conclusion text,
  drawing_at_unix bigint NOT NULL CHECK (drawing_at_unix >= 0),
  ticket_price_gold bigint NOT NULL CHECK (ticket_price_gold > 0),
  prize_kind text NOT NULL CHECK (length(btrim(prize_kind)) > 0),
  winner_percentage smallint,
  created_by_guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  created_at_unix bigint NOT NULL CHECK (created_at_unix >= 0),
  updated_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  updated_at_unix bigint CHECK (updated_at_unix IS NULL OR updated_at_unix >= created_at_unix),
  live_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  live_at_unix bigint CHECK (live_at_unix IS NULL OR live_at_unix >= created_at_unix),
  concluded_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  concluded_at_unix bigint CHECK (concluded_at_unix IS NULL OR concluded_at_unix >= created_at_unix),
  total_entries integer CHECK (total_entries IS NULL OR total_entries >= 0),
  selected_index integer CHECK (selected_index IS NULL OR selected_index >= 0),
  winning_claim_id uuid,
  CHECK (status IN ('listed', 'live', 'concluded')),
  CHECK (conclusion IS NULL OR conclusion IN ('drawn', 'operator_cancelled', 'no_participation')),
  CHECK (
    (prize_kind = 'gold'
      AND winner_percentage IS NOT NULL
      AND winner_percentage BETWEEN 1 AND 100)
    OR (prize_kind <> 'gold' AND winner_percentage IS NULL)
  ),
  CHECK (
    (status = 'listed'
      AND conclusion IS NULL
      AND live_by_guildie_id IS NULL AND live_at_unix IS NULL
      AND concluded_by_guildie_id IS NULL AND concluded_at_unix IS NULL
      AND total_entries IS NULL AND selected_index IS NULL AND winning_claim_id IS NULL)
    OR
    (status = 'live'
      AND conclusion IS NULL
      AND live_by_guildie_id IS NOT NULL AND live_at_unix IS NOT NULL
      AND concluded_by_guildie_id IS NULL AND concluded_at_unix IS NULL
      AND total_entries IS NULL AND selected_index IS NULL AND winning_claim_id IS NULL)
    OR
    (status = 'concluded' AND conclusion = 'drawn'
      AND live_by_guildie_id IS NOT NULL AND live_at_unix IS NOT NULL
      AND concluded_by_guildie_id IS NOT NULL AND concluded_at_unix IS NOT NULL
      AND total_entries IS NOT NULL AND total_entries > 0
      AND selected_index IS NOT NULL AND winning_claim_id IS NOT NULL)
    OR
    (status = 'concluded' AND conclusion = 'no_participation'
      AND live_by_guildie_id IS NOT NULL AND live_at_unix IS NOT NULL
      AND concluded_by_guildie_id IS NOT NULL AND concluded_at_unix IS NOT NULL
      AND total_entries IS NULL AND selected_index IS NULL AND winning_claim_id IS NULL)
    OR
    (status = 'concluded' AND conclusion = 'operator_cancelled'
      AND ((live_by_guildie_id IS NULL AND live_at_unix IS NULL)
        OR (live_by_guildie_id IS NOT NULL AND live_at_unix IS NOT NULL))
      AND concluded_by_guildie_id IS NOT NULL AND concluded_at_unix IS NOT NULL
      AND total_entries IS NULL AND selected_index IS NULL AND winning_claim_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS raffle_claims (
  claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES raffle_rounds(round_id) ON DELETE RESTRICT,
  claimant_guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  character_record_id uuid NOT NULL REFERENCES characters(character_record_id) ON DELETE RESTRICT,
  requested_ticket_count integer NOT NULL CHECK (requested_ticket_count > 0),
  promised_gold_value bigint NOT NULL CHECK (promised_gold_value > 0),
  created_at_unix bigint NOT NULL CHECK (created_at_unix >= 0),
  resolution_kind text,
  approved_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  approved_at_unix bigint,
  denied_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  denied_at_unix bigint,
  denial_reason text,
  cancelled_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  cancelled_at_unix bigint,
  CHECK (resolution_kind IS NULL OR resolution_kind IN ('approved', 'denied', 'cancelled')),
  CHECK (approved_at_unix IS NULL OR approved_at_unix >= created_at_unix),
  CHECK (denied_at_unix IS NULL OR denied_at_unix >= created_at_unix),
  CHECK (cancelled_at_unix IS NULL OR cancelled_at_unix >= created_at_unix),
  CHECK (
    (resolution_kind IS NULL
      AND approved_by_guildie_id IS NULL AND approved_at_unix IS NULL
      AND denied_by_guildie_id IS NULL AND denied_at_unix IS NULL AND denial_reason IS NULL
      AND cancelled_by_guildie_id IS NULL AND cancelled_at_unix IS NULL)
    OR
    (resolution_kind = 'approved'
      AND approved_by_guildie_id IS NOT NULL AND approved_at_unix IS NOT NULL
      AND denied_by_guildie_id IS NULL AND denied_at_unix IS NULL AND denial_reason IS NULL
      AND cancelled_by_guildie_id IS NULL AND cancelled_at_unix IS NULL)
    OR
    (resolution_kind = 'denied'
      AND approved_by_guildie_id IS NULL AND approved_at_unix IS NULL
      AND denied_by_guildie_id IS NOT NULL AND denied_at_unix IS NOT NULL
      AND denial_reason IS NOT NULL AND length(btrim(denial_reason)) > 0
      AND cancelled_by_guildie_id IS NULL AND cancelled_at_unix IS NULL)
    OR
    (resolution_kind = 'cancelled'
      AND approved_by_guildie_id IS NULL AND approved_at_unix IS NULL
      AND denied_by_guildie_id IS NULL AND denied_at_unix IS NULL AND denial_reason IS NULL
      AND cancelled_by_guildie_id IS NOT NULL AND cancelled_at_unix IS NOT NULL)
  )
);

ALTER TABLE raffle_rounds
  ADD CONSTRAINT raffle_rounds_winning_claim_fk
  FOREIGN KEY (winning_claim_id)
  REFERENCES raffle_claims(claim_id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS raffle_rounds_guild_status_idx
  ON raffle_rounds(guild_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS raffle_rounds_one_live_per_guild_idx
  ON raffle_rounds(guild_id)
  WHERE status = 'live';

CREATE INDEX IF NOT EXISTS raffle_claims_round_resolution_idx
  ON raffle_claims(round_id, resolution_kind);

CREATE INDEX IF NOT EXISTS raffle_claims_claimant_guildie_idx
  ON raffle_claims(claimant_guildie_id);
