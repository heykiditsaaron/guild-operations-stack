CREATE TABLE IF NOT EXISTS raid_events (
  raid_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE RESTRICT,
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  description text,
  occurs_start_unix bigint NOT NULL CHECK (occurs_start_unix > 0),
  occurs_end_unix bigint,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  eligibility text NOT NULL CHECK (eligibility IN ('guild_character_member', 'guildie', 'anyone')),
  raid_size integer NOT NULL CHECK (raid_size BETWEEN 1 AND 40),
  signups_open boolean NOT NULL DEFAULT false,
  created_by_guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  created_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  updated_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  CHECK (occurs_end_unix IS NULL OR occurs_end_unix >= occurs_start_unix)
);

CREATE TABLE IF NOT EXISTS raid_applicants (
  applicant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id uuid NOT NULL REFERENCES raid_events(raid_id) ON DELETE CASCADE,
  anchor_kind text NOT NULL CHECK (anchor_kind IN ('guildie', 'discord_user')),
  anchor_value text NOT NULL CHECK (length(btrim(anchor_value)) > 0),
  resolved_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  created_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  UNIQUE (raid_id, anchor_kind, anchor_value)
);

CREATE TABLE IF NOT EXISTS raid_signup_rows (
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
  CHECK (cardinality(willing_specs) > 0),
  CHECK (cardinality(willing_roles) > 0),
  CHECK (willing_roles <@ ARRAY['tank', 'healer', 'damage']::text[]),
  CHECK (
    (
      character_region IS NOT NULL
      AND character_realm_id IS NOT NULL
      AND character_id IS NOT NULL
      AND declared_class IS NULL
    )
    OR
    (
      character_region IS NULL
      AND character_realm_id IS NULL
      AND character_id IS NULL
      AND declared_class IS NOT NULL
      AND length(btrim(declared_class)) > 0
    )
  ),
  UNIQUE (raid_id, applicant_id, signup_row_id),
  FOREIGN KEY (character_region, character_realm_id, character_id)
    REFERENCES characters(region, realm_id, character_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS raid_assignments (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id uuid NOT NULL REFERENCES raid_events(raid_id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES raid_applicants(applicant_id) ON DELETE CASCADE,
  signup_row_id uuid NOT NULL,
  slot_index integer NOT NULL CHECK (slot_index BETWEEN 1 AND 40),
  selected_spec text NOT NULL CHECK (length(btrim(selected_spec)) > 0),
  selected_role text NOT NULL CHECK (selected_role IN ('tank', 'healer', 'damage')),
  assigned_by_guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  assigned_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  UNIQUE (raid_id, slot_index),
  UNIQUE (raid_id, applicant_id),
  UNIQUE (raid_id, signup_row_id),
  FOREIGN KEY (raid_id, applicant_id, signup_row_id)
    REFERENCES raid_signup_rows(raid_id, applicant_id, signup_row_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS raid_events_occurs_idx
  ON raid_events(occurs_start_unix);

CREATE INDEX IF NOT EXISTS raid_signup_rows_applicant_idx
  ON raid_signup_rows(raid_id, applicant_id);

CREATE INDEX IF NOT EXISTS raid_assignments_raid_idx
  ON raid_assignments(raid_id, slot_index);

INSERT INTO guild_rank_capabilities (guild_id, rank_index, capability)
SELECT guild_id, rank_index, 'raid.create'
  FROM guild_rank_definitions
 WHERE rank_index IN (0, 1, 2)
ON CONFLICT (guild_id, rank_index, capability) DO NOTHING;
