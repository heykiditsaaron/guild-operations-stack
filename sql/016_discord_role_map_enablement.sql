ALTER TABLE guild_discord_projection_settings
  ADD COLUMN IF NOT EXISTS linked_enabled boolean;

ALTER TABLE guild_discord_projection_settings
  ADD COLUMN IF NOT EXISTS rank_enabled boolean;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'guild_discord_projection_settings'
       AND column_name = 'enabled'
  ) THEN
    EXECUTE '
      UPDATE guild_discord_projection_settings
         SET linked_enabled = COALESCE(linked_enabled, enabled),
             rank_enabled = COALESCE(rank_enabled, enabled)';

    ALTER TABLE guild_discord_projection_settings
      DROP COLUMN enabled;
  END IF;
END $$;

UPDATE guild_discord_projection_settings
   SET linked_enabled = COALESCE(linked_enabled, false),
       rank_enabled = COALESCE(rank_enabled, false);

ALTER TABLE guild_discord_projection_settings
  ALTER COLUMN linked_enabled SET DEFAULT false,
  ALTER COLUMN linked_enabled SET NOT NULL,
  ALTER COLUMN rank_enabled SET DEFAULT false,
  ALTER COLUMN rank_enabled SET NOT NULL;
