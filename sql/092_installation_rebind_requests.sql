-- Host-declared, one-time rebinding intent. The active guild remains unchanged
-- until a destination Guild Master authorizes the pending request.
CREATE TABLE installation_rebind_requests (
  request_id uuid PRIMARY KEY,
  region text NOT NULL,
  realm_slug text NOT NULL,
  guild_name text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  authorized_by_identity_id text
);
CREATE UNIQUE INDEX installation_rebind_one_pending
  ON installation_rebind_requests ((true))
  WHERE completed_at IS NULL AND cancelled_at IS NULL;
