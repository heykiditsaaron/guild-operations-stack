CREATE TABLE IF NOT EXISTS activity_plugin_capability_declarations (
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
