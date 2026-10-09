-- Discord raid message coordinates are durable projection receipts, not Raid authority.
CREATE TABLE discord_raid_projections (
  raid_id text PRIMARY KEY,
  discord_channel_id text NOT NULL,
  discord_message_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
