CREATE TABLE raid_events (
  raid_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE RESTRICT,
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  description text,
  occurs_start_unix bigint NOT NULL CHECK (occurs_start_unix > 0),
  occurs_end_unix bigint,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  eligibility text NOT NULL CHECK (eligibility IN ('guild_character_member', 'guildie', 'anyone')),
  difficulty text NOT NULL CHECK (difficulty IN ('normal', 'heroic', 'mythic')),
  created_by_guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  created_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  updated_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  cancelled_at_unix bigint,
  cancelled_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  CHECK (occurs_end_unix IS NULL OR occurs_end_unix >= occurs_start_unix),
  CHECK ((cancelled_at_unix IS NULL) = (cancelled_by_guildie_id IS NULL))
);

CREATE TABLE raid_applicants (
  applicant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id uuid NOT NULL REFERENCES raid_events(raid_id) ON DELETE CASCADE,
  anchor_kind text NOT NULL CHECK (anchor_kind IN ('guildie', 'external')),
  anchor_value text NOT NULL CHECK (length(btrim(anchor_value)) > 0),
  resolved_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  created_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  UNIQUE (raid_id, anchor_kind, anchor_value)
);

CREATE TABLE raid_signup_rows (
  signup_row_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id uuid NOT NULL REFERENCES raid_events(raid_id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES raid_applicants(applicant_id) ON DELETE CASCADE,
  character_region text,
  character_realm_id text,
  character_id text,
  declared_class text,
  willing_specs text[] NOT NULL,
  willing_roles text[] NOT NULL,
  created_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  updated_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  withdrawn_at_unix bigint,
  CHECK (cardinality(willing_specs) > 0),
  CHECK (cardinality(willing_roles) > 0),
  CHECK (willing_roles <@ ARRAY['tank', 'healer', 'damage']::text[]),
  CHECK (((character_region IS NOT NULL AND character_realm_id IS NOT NULL AND character_id IS NOT NULL AND declared_class IS NULL)
      OR (character_region IS NULL AND character_realm_id IS NULL AND character_id IS NULL AND declared_class IS NOT NULL AND length(btrim(declared_class)) > 0))),
  UNIQUE (raid_id, applicant_id, signup_row_id),
  FOREIGN KEY (character_region, character_realm_id, character_id)
    REFERENCES characters(region, realm_id, character_id) ON DELETE RESTRICT
);

CREATE TABLE raid_assignments (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id uuid NOT NULL REFERENCES raid_events(raid_id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES raid_applicants(applicant_id) ON DELETE CASCADE,
  signup_row_id uuid NOT NULL,
  selected_spec text NOT NULL CHECK (length(btrim(selected_spec)) > 0),
  selected_role text NOT NULL CHECK (selected_role IN ('tank', 'healer', 'damage')),
  assigned_by_guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  assigned_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  UNIQUE (raid_id, applicant_id),
  UNIQUE (raid_id, signup_row_id),
  FOREIGN KEY (raid_id, applicant_id, signup_row_id)
    REFERENCES raid_signup_rows(raid_id, applicant_id, signup_row_id) ON DELETE CASCADE
);

CREATE TABLE raid_requirements (
  raid_id uuid NOT NULL REFERENCES raid_events(raid_id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  value text NOT NULL CHECK (length(btrim(value)) > 0),
  PRIMARY KEY (raid_id, position)
);

CREATE TABLE raid_action_history (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id uuid NOT NULL REFERENCES raid_events(raid_id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created', 'modified', 'assignment_established', 'assignment_modified', 'assignment_withdrawn', 'signup_denied')),
  actor_guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  occurred_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint)
);

CREATE TABLE raid_signup_denials (
  raid_id uuid NOT NULL REFERENCES raid_events(raid_id) ON DELETE CASCADE,
  signup_row_id uuid NOT NULL REFERENCES raid_signup_rows(signup_row_id) ON DELETE CASCADE,
  denied_by_guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  denied_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  PRIMARY KEY (raid_id, signup_row_id)
);

CREATE INDEX raid_events_occurs_idx ON raid_events(occurs_start_unix);
CREATE INDEX raid_events_active_occurs_idx ON raid_events(guild_id, occurs_start_unix) WHERE cancelled_at_unix IS NULL;
CREATE INDEX raid_signup_rows_applicant_idx ON raid_signup_rows(raid_id, applicant_id);
CREATE INDEX raid_signup_rows_active_idx ON raid_signup_rows(raid_id, applicant_id) WHERE withdrawn_at_unix IS NULL;
CREATE INDEX raid_assignments_raid_idx ON raid_assignments(raid_id, assigned_at_unix, assignment_id);
CREATE INDEX raid_action_history_raid_idx ON raid_action_history(raid_id, occurred_at_unix, action_id);
CREATE UNIQUE INDEX raid_signup_rows_active_character_origin_uq
  ON raid_signup_rows (raid_id, applicant_id, character_region, character_realm_id, character_id)
  WHERE withdrawn_at_unix IS NULL AND character_id IS NOT NULL;
CREATE UNIQUE INDEX raid_signup_rows_active_declared_origin_uq
  ON raid_signup_rows (raid_id, applicant_id, declared_class)
  WHERE withdrawn_at_unix IS NULL AND declared_class IS NOT NULL;
