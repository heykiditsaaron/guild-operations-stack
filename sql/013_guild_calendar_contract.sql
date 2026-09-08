DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'guild_event_calendar_listings'
       AND column_name = 'guild_event_kind'
  ) THEN
    UPDATE guild_event_calendar_listings
       SET guild_event_title = COALESCE(
         NULLIF(btrim(guild_event_title), ''),
         initcap(replace(replace(guild_event_kind, '-', ' '), '_', ' '))
       );
  END IF;
END $$;

ALTER TABLE guild_event_calendar_listings
  ALTER COLUMN guild_event_title SET NOT NULL;

ALTER TABLE guild_event_calendar_listings
  ADD COLUMN IF NOT EXISTS management_kind text NOT NULL DEFAULT 'application'
    CHECK (management_kind IN ('application', 'external'));

ALTER TABLE guild_event_calendar_listings
  DROP COLUMN IF EXISTS guild_event_kind;
