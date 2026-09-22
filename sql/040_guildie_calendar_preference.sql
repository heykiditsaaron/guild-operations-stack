CREATE TABLE guildie_calendar_preferences (
  guildie_id uuid PRIMARY KEY REFERENCES guildies(guildie_id) ON DELETE CASCADE,
  view_mode text NOT NULL CHECK (view_mode IN ('agenda', 'week', 'month')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
