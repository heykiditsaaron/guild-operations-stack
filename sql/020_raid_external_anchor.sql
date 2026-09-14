ALTER TABLE raid_applicants
  DROP CONSTRAINT IF EXISTS raid_applicants_anchor_kind_check;

ALTER TABLE raid_applicants
  ADD CONSTRAINT raid_applicants_anchor_kind_check
  CHECK (anchor_kind IN ('guildie', 'external'));
