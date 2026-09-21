ALTER TABLE guild_event_calendar_listings
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_subject text;

UPDATE guild_event_calendar_listings
   SET source_kind = 'legacy',
       source_subject = guild_event_id
 WHERE source_kind IS NULL
    OR source_subject IS NULL;

ALTER TABLE guild_event_calendar_listings
  ALTER COLUMN source_kind SET NOT NULL,
  ALTER COLUMN source_subject SET NOT NULL;

ALTER TABLE guild_event_calendar_listings
  ADD CONSTRAINT guild_event_calendar_listings_source_kind_nonempty
    CHECK (length(btrim(source_kind)) > 0),
  ADD CONSTRAINT guild_event_calendar_listings_source_subject_nonempty
    CHECK (length(btrim(source_subject)) > 0);

CREATE UNIQUE INDEX IF NOT EXISTS guild_event_calendar_listings_source_subject_key
  ON guild_event_calendar_listings(source_kind, source_subject);

ALTER TABLE guild_event_calendar_listings
  DROP COLUMN IF EXISTS guild_event_title,
  DROP COLUMN IF EXISTS guild_event_destination,
  DROP COLUMN IF EXISTS guild_event_category;
