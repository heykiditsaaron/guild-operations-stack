CREATE TABLE IF NOT EXISTS activity_plugin_registrations (
  activity_kind text PRIMARY KEY CHECK (length(btrim(activity_kind)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  first_registered_at_unix bigint NOT NULL CHECK (first_registered_at_unix >= 0),
  last_registered_at_unix bigint NOT NULL CHECK (last_registered_at_unix >= first_registered_at_unix),
  last_plugin_version text,
  CHECK (last_plugin_version IS NULL OR length(btrim(last_plugin_version)) > 0)
);
