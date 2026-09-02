CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS guild_subjects (
  subject_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blizzard_principals (
  subject_id uuid PRIMARY KEY REFERENCES guild_subjects(subject_id) ON DELETE RESTRICT,
  region text NOT NULL,
  principal_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (region, principal_id)
);

CREATE TABLE IF NOT EXISTS wow_accounts (
  wow_account_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES guild_subjects(subject_id) ON DELETE RESTRICT,
  region text NOT NULL,
  wow_account_id text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (region, wow_account_id)
);

CREATE TABLE IF NOT EXISTS characters (
  character_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES guild_subjects(subject_id) ON DELETE RESTRICT,
  wow_account_record_id uuid NOT NULL REFERENCES wow_accounts(wow_account_record_id) ON DELETE RESTRICT,
  region text NOT NULL,
  realm_id text NOT NULL,
  character_id text NOT NULL,
  name text NOT NULL,
  realm_name text,
  realm_slug text,
  level integer,
  faction text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (region, realm_id, character_id)
);

CREATE TABLE IF NOT EXISTS guilds (
  guild_id text PRIMARY KEY,
  region text NOT NULL,
  realm_id text NOT NULL,
  name text NOT NULL,
  realm_name text,
  realm_slug text NOT NULL,
  faction text,
  created_timestamp bigint,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guild_roster_memberships (
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE RESTRICT,
  region text NOT NULL,
  realm_id text NOT NULL,
  character_id text NOT NULL,
  rank_index integer NOT NULL CHECK (rank_index >= 0),
  character_name text NOT NULL,
  realm_name text,
  realm_slug text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  currently_present boolean NOT NULL DEFAULT true,
  PRIMARY KEY (guild_id, region, realm_id, character_id)
);

CREATE TABLE IF NOT EXISTS guild_rank_definitions (
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE RESTRICT,
  rank_index integer NOT NULL CHECK (rank_index >= 0),
  display_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, rank_index)
);

CREATE TABLE IF NOT EXISTS subject_main_characters (
  subject_id uuid NOT NULL REFERENCES guild_subjects(subject_id) ON DELETE RESTRICT,
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE RESTRICT,
  region text NOT NULL,
  realm_id text NOT NULL,
  character_id text NOT NULL,
  selected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, guild_id),
  FOREIGN KEY (region, realm_id, character_id)
    REFERENCES characters(region, realm_id, character_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS authentication_attempts (
  attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE,
  region text NOT NULL,
  return_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE TABLE IF NOT EXISTS application_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES guild_subjects(subject_id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS application_sessions_subject_id_idx
  ON application_sessions(subject_id);

CREATE INDEX IF NOT EXISTS characters_subject_id_idx
  ON characters(subject_id);

CREATE INDEX IF NOT EXISTS guild_roster_memberships_current_idx
  ON guild_roster_memberships(guild_id, currently_present);

CREATE INDEX IF NOT EXISTS guild_roster_memberships_character_idx
  ON guild_roster_memberships(region, realm_id, character_id);
