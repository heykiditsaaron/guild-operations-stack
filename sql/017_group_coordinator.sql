CREATE TABLE IF NOT EXISTS coordinations (
  coordination_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE RESTRICT,
  applicant_eligibility text NOT NULL CHECK (applicant_eligibility IN ('guild_character', 'guildie', 'anyone')),
  created_at_unix bigint NOT NULL DEFAULT floor(extract(epoch FROM now()))::bigint CHECK (created_at_unix >= 0)
);

CREATE TABLE IF NOT EXISTS coordination_organizers (
  coordination_id uuid NOT NULL REFERENCES coordinations(coordination_id) ON DELETE CASCADE,
  guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  established_at_unix bigint NOT NULL DEFAULT floor(extract(epoch FROM now()))::bigint CHECK (established_at_unix >= 0),
  PRIMARY KEY (coordination_id, guildie_id)
);

CREATE TABLE IF NOT EXISTS coordination_applicants (
  applicant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordination_id uuid NOT NULL REFERENCES coordinations(coordination_id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('guild_character', 'guildie', 'external')),
  guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  character_record_id uuid REFERENCES characters(character_record_id) ON DELETE RESTRICT,
  external_label text,
  created_at_unix bigint NOT NULL DEFAULT floor(extract(epoch FROM now()))::bigint CHECK (created_at_unix >= 0),
  CHECK (
    (source = 'guild_character' AND guildie_id IS NOT NULL AND character_record_id IS NOT NULL AND external_label IS NULL)
    OR (source = 'guildie' AND guildie_id IS NOT NULL AND character_record_id IS NULL AND external_label IS NULL)
    OR (source = 'external' AND guildie_id IS NULL AND character_record_id IS NULL AND external_label IS NOT NULL AND length(btrim(external_label)) > 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS coordination_applicants_guild_character_unique
  ON coordination_applicants(coordination_id, character_record_id)
  WHERE source = 'guild_character';

CREATE UNIQUE INDEX IF NOT EXISTS coordination_applicants_guildie_unique
  ON coordination_applicants(coordination_id, guildie_id)
  WHERE source = 'guildie';

CREATE TABLE IF NOT EXISTS coordination_opportunities (
  opportunity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordination_id uuid NOT NULL REFERENCES coordinations(coordination_id) ON DELETE CASCADE,
  key text NOT NULL CHECK (length(btrim(key)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  required_role text CHECK (required_role IS NULL OR required_role IN ('tank', 'healer', 'damage')),
  quantity integer CHECK (quantity IS NULL OR quantity > 0),
  created_at_unix bigint NOT NULL DEFAULT floor(extract(epoch FROM now()))::bigint CHECK (created_at_unix >= 0),
  UNIQUE (coordination_id, key)
);

CREATE TABLE IF NOT EXISTS coordination_goals (
  goal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordination_id uuid NOT NULL REFERENCES coordinations(coordination_id) ON DELETE CASCADE,
  tag text NOT NULL CHECK (length(btrim(tag)) > 0),
  minimum integer NOT NULL CHECK (minimum > 0),
  created_at_unix bigint NOT NULL DEFAULT floor(extract(epoch FROM now()))::bigint CHECK (created_at_unix >= 0),
  UNIQUE (coordination_id, tag)
);

CREATE TABLE IF NOT EXISTS coordination_offers (
  offer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordination_id uuid NOT NULL REFERENCES coordinations(coordination_id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES coordination_applicants(applicant_id) ON DELETE RESTRICT,
  character_record_id uuid REFERENCES characters(character_record_id) ON DELETE RESTRICT,
  class_name text,
  spec_name text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at_unix bigint NOT NULL DEFAULT floor(extract(epoch FROM now()))::bigint CHECK (created_at_unix >= 0),
  withdrawn_at_unix bigint CHECK (withdrawn_at_unix IS NULL OR withdrawn_at_unix >= created_at_unix),
  CHECK ((class_name IS NULL AND spec_name IS NULL) OR (class_name IS NOT NULL AND spec_name IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS coordination_offers_coordination_idx
  ON coordination_offers(coordination_id, created_at_unix);

CREATE TABLE IF NOT EXISTS coordination_assignments (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordination_id uuid NOT NULL REFERENCES coordinations(coordination_id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES coordination_offers(offer_id) ON DELETE RESTRICT,
  opportunity_id uuid NOT NULL REFERENCES coordination_opportunities(opportunity_id) ON DELETE RESTRICT,
  assigned_by_guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  assigned_at_unix bigint NOT NULL DEFAULT floor(extract(epoch FROM now()))::bigint CHECK (assigned_at_unix >= 0),
  released_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  released_at_unix bigint CHECK (released_at_unix IS NULL OR released_at_unix >= assigned_at_unix),
  CHECK ((released_at_unix IS NULL AND released_by_guildie_id IS NULL) OR (released_at_unix IS NOT NULL AND released_by_guildie_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS coordination_assignments_active_offer_unique
  ON coordination_assignments(offer_id)
  WHERE released_at_unix IS NULL;

CREATE INDEX IF NOT EXISTS coordination_assignments_active_opportunity_idx
  ON coordination_assignments(opportunity_id)
  WHERE released_at_unix IS NULL;
