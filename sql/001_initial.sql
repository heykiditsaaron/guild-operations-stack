CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE guildies (
  guildie_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE blizzard_principals (
  guildie_id uuid PRIMARY KEY REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  region text NOT NULL,
  principal_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (region, principal_id)
);

CREATE TABLE wow_accounts (
  wow_account_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  region text NOT NULL,
  wow_account_id text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (region, wow_account_id)
);

CREATE TABLE characters (
  character_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
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
  currently_controlled boolean NOT NULL DEFAULT true,
  UNIQUE (region, realm_id, character_id)
);

CREATE TABLE guilds (
  guild_id text PRIMARY KEY,
  region text NOT NULL,
  realm_id text NOT NULL,
  name text NOT NULL,
  realm_name text,
  realm_slug text NOT NULL,
  faction text,
  created_timestamp bigint,
  blizzard_reference_href text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN guilds.blizzard_reference_href IS
  'Canonical Blizzard guild API reference used as the durable transport locator for refresh operations.';

CREATE TABLE guild_roster_memberships (
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

CREATE TABLE wow_character_profiles (
  region text NOT NULL,
  realm_id text NOT NULL,
  character_id text NOT NULL,
  name text NOT NULL,
  realm_name text,
  realm_slug text NOT NULL,
  level integer,
  faction text,
  race_id text,
  race_name text,
  class_id text,
  class_name text,
  active_spec_id text,
  active_spec_name text,
  avatar_url text,
  inset_url text,
  main_url text,
  profile_payload jsonb NOT NULL,
  media_payload jsonb,
  profile_acquired_at timestamptz NOT NULL,
  media_acquired_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (region, realm_id, character_id)
);

CREATE TABLE wow_character_presentation_acquisition (
  region text NOT NULL,
  realm_id text NOT NULL,
  character_id text NOT NULL,
  profile_last_attempted_at timestamptz,
  profile_last_failure_status integer,
  media_last_attempted_at timestamptz,
  media_last_failure_status integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (region, realm_id, character_id)
);

CREATE TABLE guild_rank_definitions (
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE RESTRICT,
  rank_index integer NOT NULL CHECK (rank_index >= 0),
  display_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, rank_index)
);

CREATE TABLE guild_rank_capabilities (
  guild_id text NOT NULL,
  rank_index integer NOT NULL,
  capability text NOT NULL CHECK (length(capability) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, rank_index, capability),
  FOREIGN KEY (guild_id, rank_index)
    REFERENCES guild_rank_definitions(guild_id, rank_index)
    ON DELETE CASCADE
);

CREATE TABLE guildie_main_characters (
  guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE RESTRICT,
  region text NOT NULL,
  realm_id text NOT NULL,
  character_id text NOT NULL,
  selected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guildie_id, guild_id),
  FOREIGN KEY (region, realm_id, character_id)
    REFERENCES characters(region, realm_id, character_id)
    ON DELETE RESTRICT
);

CREATE TABLE authentication_attempts (
  attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE,
  region text NOT NULL,
  purpose text NOT NULL DEFAULT 'login' CHECK (purpose IN ('login', 'self_refresh')),
  guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  return_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK ((purpose = 'login' AND guildie_id IS NULL) OR (purpose = 'self_refresh' AND guildie_id IS NOT NULL))
);

CREATE TABLE application_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guildie_id uuid NOT NULL REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE operational_records (
  operational_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at_unix bigint NOT NULL CHECK (occurred_at_unix >= 0),
  source text NOT NULL CHECK (length(btrim(source)) > 0),
  operation text NOT NULL CHECK (length(btrim(operation)) > 0),
  kind text NOT NULL CHECK (kind IN ('result', 'exception')),
  result text CHECK (result IN ('success', 'partial', 'failure')),
  actor_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE SET NULL,
  summary text NOT NULL CHECK (length(btrim(summary)) > 0),
  details jsonb,
  CHECK ((kind = 'result' AND result IS NOT NULL) OR (kind = 'exception' AND result IS NULL))
);

CREATE TABLE guild_refresh_schedule (
  guild_id text PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  interval_seconds integer NOT NULL DEFAULT 86400 CHECK (interval_seconds >= 300),
  next_due_at_unix bigint,
  CHECK (next_due_at_unix IS NULL OR next_due_at_unix >= 0),
  CHECK ((enabled AND next_due_at_unix IS NOT NULL) OR (NOT enabled AND next_due_at_unix IS NULL))
);

CREATE TABLE guild_activity_plugin_enablement (
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  activity_kind text NOT NULL,
  enabled boolean NOT NULL,
  updated_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  PRIMARY KEY (guild_id, activity_kind)
);

CREATE TABLE guild_capability_policy_configuration (
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  capability text NOT NULL,
  permitted_ranks integer[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, capability)
);

CREATE TABLE guild_event_calendar_listings (
  guild_event_id text PRIMARY KEY CHECK (length(btrim(guild_event_id)) > 0),
  occurs_at_start_unix bigint NOT NULL CHECK (occurs_at_start_unix >= 0),
  occurs_at_end_unix bigint CHECK (occurs_at_end_unix IS NULL OR occurs_at_end_unix >= occurs_at_start_unix),
  discoverable boolean NOT NULL DEFAULT true,
  registered_at_unix bigint NOT NULL CHECK (registered_at_unix >= 0),
  updated_at_unix bigint NOT NULL CHECK (updated_at_unix >= registered_at_unix),
  management_kind text NOT NULL DEFAULT 'application' CHECK (management_kind IN ('application', 'external')),
  source_kind text NOT NULL CHECK (length(btrim(source_kind)) > 0),
  source_subject text NOT NULL CHECK (length(btrim(source_subject)) > 0)
);

CREATE TABLE emission_publications (
  publication_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_id text NOT NULL CHECK (length(btrim(transport_id)) > 0),
  code text NOT NULL CHECK (length(btrim(code)) > 0),
  parent text CHECK (parent IS NULL OR length(btrim(parent)) > 0),
  subject text NOT NULL CHECK (length(btrim(subject)) > 0),
  published_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint)
);

CREATE TABLE emission_consumer_receipts (
  publication_id uuid NOT NULL REFERENCES emission_publications(publication_id) ON DELETE CASCADE,
  consumer_id text NOT NULL CHECK (length(btrim(consumer_id)) > 0),
  acknowledged_at_unix bigint,
  last_attempted_at_unix bigint,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  PRIMARY KEY (publication_id, consumer_id)
);

CREATE TABLE guild_presentation_settings (
  guild_id text PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
  theme_key text NOT NULL DEFAULT 'default' CHECK (theme_key IN ('default', 'alliance', 'horde')),
  raider_io_url text,
  warcraft_logs_url text,
  guild_settings_location_acknowledged boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE guildie_calendar_preferences (
  guildie_id uuid PRIMARY KEY REFERENCES guildies(guildie_id) ON DELETE CASCADE,
  view_mode text NOT NULL CHECK (view_mode IN ('agenda', 'week', 'month')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE installation_guild_binding (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE RESTRICT,
  bound_at timestamptz NOT NULL DEFAULT now(),
  bound_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  authorized_at timestamptz,
  authorized_by_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE RESTRICT,
  authorization_kind text CHECK (authorization_kind IS NULL OR authorization_kind IN ('guild_master', 'original_install_bypass')),
  CHECK (
    (authorized_at IS NULL AND authorized_by_guildie_id IS NULL AND authorization_kind IS NULL)
    OR
    (authorized_at IS NOT NULL AND authorized_by_guildie_id IS NOT NULL AND authorization_kind IS NOT NULL)
  )
);

CREATE TABLE installation_blizzard_configuration (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  client_id text NOT NULL,
  client_secret_ciphertext text NOT NULL,
  configured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE installation_web_configuration (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  public_origin text NOT NULL,
  established_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activity_participation_offers (
  participation_offer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_kind text NOT NULL CHECK (length(btrim(activity_kind)) > 0),
  activity_id text NOT NULL CHECK (length(btrim(activity_id)) > 0),
  party_kind text NOT NULL CHECK (party_kind IN ('guildie', 'external')),
  party_reference text NOT NULL CHECK (length(btrim(party_reference)) > 0),
  procedure_reference text NOT NULL CHECK (length(btrim(procedure_reference)) > 0),
  offered_at_unix bigint NOT NULL CHECK (offered_at_unix >= 0),
  revoked_at_unix bigint CHECK (revoked_at_unix IS NULL OR revoked_at_unix >= offered_at_unix),
  closed_at_unix bigint,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT activity_participation_offer_components_array CHECK (jsonb_typeof(components) = 'array'),
  UNIQUE (activity_kind, activity_id, procedure_reference)
);

CREATE TABLE activity_participations (
  participation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_kind text NOT NULL CHECK (length(btrim(activity_kind)) > 0),
  activity_id text NOT NULL CHECK (length(btrim(activity_id)) > 0),
  party_kind text NOT NULL CHECK (party_kind IN ('guildie', 'external')),
  party_reference text NOT NULL CHECK (length(btrim(party_reference)) > 0),
  procedure_reference text NOT NULL CHECK (length(btrim(procedure_reference)) > 0),
  participation_offer_id uuid UNIQUE REFERENCES activity_participation_offers(participation_offer_id) ON DELETE RESTRICT,
  established_at_unix bigint NOT NULL CHECK (established_at_unix >= 0),
  UNIQUE (activity_kind, activity_id, procedure_reference)
);

CREATE INDEX activity_participations_established_idx ON activity_participations(established_at_unix DESC);
CREATE INDEX activity_participations_party_idx ON activity_participations(party_kind, party_reference, established_at_unix DESC);

CREATE TABLE activity_plugin_registrations (
  activity_kind text PRIMARY KEY CHECK (length(btrim(activity_kind)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  first_registered_at_unix bigint NOT NULL CHECK (first_registered_at_unix >= 0),
  last_registered_at_unix bigint NOT NULL CHECK (last_registered_at_unix >= first_registered_at_unix),
  last_plugin_version text,
  CHECK (last_plugin_version IS NULL OR length(btrim(last_plugin_version)) > 0)
);

CREATE TABLE activity_plugin_capability_declarations (
  activity_kind text NOT NULL REFERENCES activity_plugin_registrations(activity_kind) ON DELETE CASCADE,
  capability text NOT NULL CHECK (length(btrim(capability)) > 0),
  namespace text NOT NULL CHECK (length(btrim(namespace)) > 0),
  namespace_label text NOT NULL CHECK (length(btrim(namespace_label)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  description text,
  default_permitted_ranks integer[] NOT NULL DEFAULT '{}',
  last_declared_at_unix bigint NOT NULL CHECK (last_declared_at_unix >= 0),
  PRIMARY KEY (activity_kind, capability)
);

CREATE INDEX application_sessions_guildie_id_idx ON application_sessions(guildie_id);
CREATE INDEX characters_guildie_id_idx ON characters(guildie_id);
CREATE INDEX guild_roster_memberships_current_idx ON guild_roster_memberships(guild_id, currently_present);
CREATE INDEX guild_roster_memberships_character_idx ON guild_roster_memberships(region, realm_id, character_id);
CREATE INDEX wow_character_profiles_name_idx ON wow_character_profiles(region, realm_slug, name);
CREATE INDEX operational_records_occurred_idx ON operational_records(occurred_at_unix DESC);
CREATE INDEX operational_records_source_occurred_idx ON operational_records(source, occurred_at_unix DESC);
CREATE INDEX operational_records_kind_occurred_idx ON operational_records(kind, occurred_at_unix DESC);
CREATE INDEX guild_event_calendar_listings_discoverable_occurs_idx ON guild_event_calendar_listings(discoverable, occurs_at_start_unix);
CREATE UNIQUE INDEX guild_event_calendar_listings_source_subject_key ON guild_event_calendar_listings(source_kind, source_subject);
CREATE INDEX emission_publications_published_at_idx ON emission_publications(published_at_unix, publication_id);
CREATE INDEX emission_consumer_receipts_pending_idx ON emission_consumer_receipts(publication_id, consumer_id) WHERE acknowledged_at_unix IS NULL;
CREATE INDEX activity_participation_offers_party_idx ON activity_participation_offers(party_kind, party_reference, offered_at_unix DESC);
CREATE INDEX activity_participation_offers_outstanding_idx
  ON activity_participation_offers (party_kind, party_reference, offered_at_unix DESC)
  WHERE revoked_at_unix IS NULL AND closed_at_unix IS NULL;
