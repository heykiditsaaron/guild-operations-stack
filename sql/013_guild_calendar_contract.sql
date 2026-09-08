UPDATE guild_event_calendar_listings
   SET guild_event_title = COALESCE(
     NULLIF(btrim(guild_event_title), ''),
     initcap(replace(replace(guild_event_kind, '-', ' '), '_', ' '))
   );

ALTER TABLE guild_event_calendar_listings
  ALTER COLUMN guild_event_title SET NOT NULL;

ALTER TABLE guild_event_calendar_listings
  DROP COLUMN guild_event_kind;
