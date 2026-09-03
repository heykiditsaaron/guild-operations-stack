CREATE TABLE IF NOT EXISTS raffle_rounds (
  round_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'created',
  drawing_at_unix bigint NOT NULL CHECK (drawing_at_unix >= 0),
  ticket_price_gold bigint NOT NULL CHECK (ticket_price_gold > 0),
  prize_kind text NOT NULL CHECK (length(btrim(prize_kind)) > 0),
  winner_percentage smallint,
  created_by_subject_id uuid NOT NULL REFERENCES guild_subjects(subject_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  live_by_subject_id uuid REFERENCES guild_subjects(subject_id) ON DELETE RESTRICT,
  live_at timestamptz,
  concluded_by_subject_id uuid REFERENCES guild_subjects(subject_id) ON DELETE RESTRICT,
  concluded_at timestamptz,
  total_entries integer CHECK (total_entries IS NULL OR total_entries >= 0),
  selected_index integer CHECK (selected_index IS NULL OR selected_index >= 0),
  winning_claim_id uuid,
  CHECK (status IN ('created', 'live', 'drawn', 'admin_cancelled', 'no_entry_cancelled')),
  CHECK (
    (prize_kind = 'gold' AND winner_percentage BETWEEN 1 AND 100)
    OR (prize_kind <> 'gold' AND winner_percentage IS NULL)
  ),
  CHECK (
    (status = 'created'
      AND live_by_subject_id IS NULL AND live_at IS NULL
      AND concluded_by_subject_id IS NULL AND concluded_at IS NULL
      AND total_entries IS NULL AND selected_index IS NULL AND winning_claim_id IS NULL)
    OR
    (status = 'live'
      AND live_by_subject_id IS NOT NULL AND live_at IS NOT NULL
      AND concluded_by_subject_id IS NULL AND concluded_at IS NULL
      AND total_entries IS NULL AND selected_index IS NULL AND winning_claim_id IS NULL)
    OR
    (status = 'drawn'
      AND live_by_subject_id IS NOT NULL AND live_at IS NOT NULL
      AND concluded_by_subject_id IS NOT NULL AND concluded_at IS NOT NULL
      AND total_entries > 0 AND selected_index IS NOT NULL AND winning_claim_id IS NOT NULL)
    OR
    (status = 'no_entry_cancelled'
      AND live_by_subject_id IS NOT NULL AND live_at IS NOT NULL
      AND concluded_by_subject_id IS NOT NULL AND concluded_at IS NOT NULL
      AND total_entries = 0 AND selected_index IS NULL AND winning_claim_id IS NULL)
    OR
    (status = 'admin_cancelled'
      AND concluded_by_subject_id IS NOT NULL AND concluded_at IS NOT NULL
      AND total_entries IS NULL AND selected_index IS NULL AND winning_claim_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS raffle_claims (
  claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES raffle_rounds(round_id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES guild_subjects(subject_id) ON DELETE RESTRICT,
  character_record_id uuid NOT NULL REFERENCES characters(character_record_id) ON DELETE RESTRICT,
  requested_ticket_count integer NOT NULL CHECK (requested_ticket_count > 0),
  promised_gold_value bigint NOT NULL CHECK (promised_gold_value > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolution_kind text,
  approved_by_subject_id uuid REFERENCES guild_subjects(subject_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  denied_by_subject_id uuid REFERENCES guild_subjects(subject_id) ON DELETE RESTRICT,
  denied_at timestamptz,
  denial_reason text,
  cancelled_by_subject_id uuid REFERENCES guild_subjects(subject_id) ON DELETE RESTRICT,
  cancelled_at timestamptz,
  CHECK (resolution_kind IS NULL OR resolution_kind IN ('approved', 'denied', 'cancelled')),
  CHECK (
    (resolution_kind IS NULL
      AND approved_by_subject_id IS NULL AND approved_at IS NULL
      AND denied_by_subject_id IS NULL AND denied_at IS NULL AND denial_reason IS NULL
      AND cancelled_by_subject_id IS NULL AND cancelled_at IS NULL)
    OR
    (resolution_kind = 'approved'
      AND approved_by_subject_id IS NOT NULL AND approved_at IS NOT NULL
      AND denied_by_subject_id IS NULL AND denied_at IS NULL AND denial_reason IS NULL
      AND cancelled_by_subject_id IS NULL AND cancelled_at IS NULL)
    OR
    (resolution_kind = 'denied'
      AND approved_by_subject_id IS NULL AND approved_at IS NULL
      AND denied_by_subject_id IS NOT NULL AND denied_at IS NOT NULL
      AND denial_reason IS NOT NULL AND length(btrim(denial_reason)) > 0
      AND cancelled_by_subject_id IS NULL AND cancelled_at IS NULL)
    OR
    (resolution_kind = 'cancelled'
      AND approved_by_subject_id IS NULL AND approved_at IS NULL
      AND denied_by_subject_id IS NULL AND denied_at IS NULL AND denial_reason IS NULL
      AND cancelled_by_subject_id IS NOT NULL AND cancelled_at IS NOT NULL)
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'raffle_rounds_winning_claim_fk'
  ) THEN
    ALTER TABLE raffle_rounds
      ADD CONSTRAINT raffle_rounds_winning_claim_fk
      FOREIGN KEY (winning_claim_id)
      REFERENCES raffle_claims(claim_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS raffle_rounds_guild_status_idx
  ON raffle_rounds(guild_id, status);

CREATE INDEX IF NOT EXISTS raffle_claims_round_resolution_idx
  ON raffle_claims(round_id, resolution_kind);

CREATE INDEX IF NOT EXISTS raffle_claims_subject_idx
  ON raffle_claims(subject_id);

INSERT INTO guild_rank_capabilities (guild_id, rank_index, capability)
SELECT guild_id, rank_index, 'raffle.admin'
  FROM guild_rank_definitions
 WHERE rank_index IN (0, 1, 2)
ON CONFLICT (guild_id, rank_index, capability) DO NOTHING;
