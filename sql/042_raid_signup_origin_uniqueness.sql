-- Preserve one active signup per effective participation origin before enforcing uniqueness.
-- Prefer an assigned row when one exists; otherwise preserve the earliest signup.
WITH ranked_character_signups AS (
  SELECT rr.signup_row_id,
         row_number() OVER (
           PARTITION BY rr.raid_id, rr.applicant_id, rr.character_region, rr.character_realm_id, rr.character_id
           ORDER BY (ras.assignment_id IS NOT NULL) DESC, rr.created_at_unix ASC, rr.signup_row_id ASC
         ) AS origin_rank
    FROM raid_signup_rows rr
    LEFT JOIN raid_assignments ras ON ras.raid_id = rr.raid_id AND ras.signup_row_id = rr.signup_row_id
   WHERE rr.withdrawn_at_unix IS NULL
     AND rr.character_id IS NOT NULL
)
UPDATE raid_signup_rows rr
   SET withdrawn_at_unix = extract(epoch FROM now())::bigint,
       updated_at_unix = extract(epoch FROM now())::bigint
  FROM ranked_character_signups ranked
 WHERE rr.signup_row_id = ranked.signup_row_id
   AND ranked.origin_rank > 1;

WITH ranked_declared_signups AS (
  SELECT rr.signup_row_id,
         row_number() OVER (
           PARTITION BY rr.raid_id, rr.applicant_id, rr.declared_class
           ORDER BY (ras.assignment_id IS NOT NULL) DESC, rr.created_at_unix ASC, rr.signup_row_id ASC
         ) AS origin_rank
    FROM raid_signup_rows rr
    LEFT JOIN raid_assignments ras ON ras.raid_id = rr.raid_id AND ras.signup_row_id = rr.signup_row_id
   WHERE rr.withdrawn_at_unix IS NULL
     AND rr.declared_class IS NOT NULL
)
UPDATE raid_signup_rows rr
   SET withdrawn_at_unix = extract(epoch FROM now())::bigint,
       updated_at_unix = extract(epoch FROM now())::bigint
  FROM ranked_declared_signups ranked
 WHERE rr.signup_row_id = ranked.signup_row_id
   AND ranked.origin_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS raid_signup_rows_active_character_origin_uq
  ON raid_signup_rows (raid_id, applicant_id, character_region, character_realm_id, character_id)
  WHERE withdrawn_at_unix IS NULL AND character_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS raid_signup_rows_active_declared_origin_uq
  ON raid_signup_rows (raid_id, applicant_id, declared_class)
  WHERE withdrawn_at_unix IS NULL AND declared_class IS NOT NULL;
