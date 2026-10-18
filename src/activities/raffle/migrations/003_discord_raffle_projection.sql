ALTER TABLE discord_integration_configuration
  ADD COLUMN IF NOT EXISTS raffle_channel_id text;

CREATE TABLE IF NOT EXISTS discord_raffle_projections (
  raffle_id uuid PRIMARY KEY REFERENCES raffles(raffle_id) ON DELETE CASCADE,
  discord_channel_id text NOT NULL,
  discord_message_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discord_raffle_claim_projections (
  claim_id uuid PRIMARY KEY REFERENCES raffle_claims(claim_id) ON DELETE CASCADE,
  raffle_id uuid NOT NULL REFERENCES raffles(raffle_id) ON DELETE CASCADE,
  discord_channel_id text NOT NULL,
  discord_message_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
