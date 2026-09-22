CREATE TABLE guild_presentation_settings (
  guild_id text PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
  theme_key text NOT NULL DEFAULT 'default' CHECK (theme_key IN ('default', 'alliance', 'horde')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
