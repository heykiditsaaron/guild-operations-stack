CREATE TABLE IF NOT EXISTS activity_participations (
  participation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_kind text NOT NULL CHECK (length(btrim(activity_kind)) > 0),
  activity_id text NOT NULL CHECK (length(btrim(activity_id)) > 0),
  party_kind text NOT NULL CHECK (party_kind IN ('guildie', 'external')),
  party_reference text NOT NULL CHECK (length(btrim(party_reference)) > 0),
  procedure_reference text NOT NULL CHECK (length(btrim(procedure_reference)) > 0),
  offered_at_unix bigint NOT NULL CHECK (offered_at_unix >= 0),
  revoked_at_unix bigint CHECK (revoked_at_unix IS NULL OR revoked_at_unix >= offered_at_unix),
  UNIQUE (activity_kind, activity_id, procedure_reference)
);

CREATE INDEX IF NOT EXISTS activity_participations_party_idx
  ON activity_participations (party_kind, party_reference, offered_at_unix DESC);

INSERT INTO activity_participations (
  activity_kind,
  activity_id,
  party_kind,
  party_reference,
  procedure_reference,
  offered_at_unix,
  revoked_at_unix
)
SELECT
  'raid',
  rr.raid_id::text,
  ra.anchor_kind,
  ra.anchor_value,
  rr.signup_row_id::text,
  rr.created_at_unix,
  rr.withdrawn_at_unix
FROM raid_signup_rows rr
JOIN raid_applicants ra ON ra.applicant_id = rr.applicant_id
ON CONFLICT (activity_kind, activity_id, procedure_reference) DO NOTHING;

INSERT INTO activity_participations (
  activity_kind,
  activity_id,
  party_kind,
  party_reference,
  procedure_reference,
  offered_at_unix,
  revoked_at_unix
)
SELECT
  'raffle',
  rc.raffle_id::text,
  'guildie',
  rc.claimant_guildie_id::text,
  rc.claim_id::text,
  rc.created_at_unix,
  rc.revoked_at_unix
FROM raffle_claims rc
ON CONFLICT (activity_kind, activity_id, procedure_reference) DO NOTHING;
