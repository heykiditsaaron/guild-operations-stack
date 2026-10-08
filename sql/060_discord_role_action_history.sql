-- Discord Integration-owned record of role projection attempts and outcomes.
CREATE TABLE discord_role_action_history (
  action_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  guild_id text NOT NULL,
  discord_guild_id text NOT NULL,
  discord_user_id text NOT NULL,
  wow_identity_id uuid NOT NULL,
  discord_role_id text,
  action text NOT NULL CHECK (action IN ('grant', 'remove', 'reconcile')),
  outcome text NOT NULL CHECK (outcome IN ('succeeded', 'failed', 'not_ready')),
  detail text
);
CREATE INDEX discord_role_action_history_recent_idx ON discord_role_action_history (occurred_at DESC, action_id DESC);
