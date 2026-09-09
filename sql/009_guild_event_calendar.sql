CREATE TABLE IF NOT EXISTS guild_event_calendar_listings (
  guild_event_id text PRIMARY KEY CHECK (length(btrim(guild_event_id)) > 0),
  guild_event_kind text NOT NULL CHECK (length(btrim(guild_event_kind)) > 0),
  occurs_at_start_unix bigint NOT NULL CHECK (occurs_at_start_unix >= 0),
  occurs_at_end_unix bigint CHECK (occurs_at_end_unix IS NULL OR occurs_at_end_unix >= occurs_at_start_unix),
  guild_event_category text CHECK (guild_event_category IS NULL OR length(btrim(guild_event_category)) > 0),
  discoverable boolean NOT NULL DEFAULT true,
  registered_at_unix bigint NOT NULL CHECK (registered_at_unix >= 0),
  updated_at_unix bigint NOT NULL CHECK (updated_at_unix >= registered_at_unix),
  guild_event_title text CHECK (guild_event_title IS NULL OR length(btrim(guild_event_title)) > 0),
  guild_event_destination text CHECK (guild_event_destination IS NULL OR length(btrim(guild_event_destination)) > 0)
);

CREATE INDEX IF NOT EXISTS guild_event_calendar_listings_discoverable_occurs_idx
  ON guild_event_calendar_listings(discoverable, occurs_at_start_unix);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'guild_event_calendar_listings'
       AND column_name = 'guild_event_kind'
  ) THEN
    INSERT INTO guild_event_calendar_listings (
      guild_event_id,
      guild_event_kind,
      occurs_at_start_unix,
      occurs_at_end_unix,
      guild_event_title,
      guild_event_destination,
      guild_event_category,
      discoverable,
      registered_at_unix,
      updated_at_unix
    )
    SELECT
      guild_event_id,
      guild_event_kind,
      occurs_at_start_unix,
      occurs_at_end_unix,
      guild_event_title,
      guild_event_destination,
      guild_event_category,
      discoverable,
      registered_at_unix,
      updated_at_unix
    FROM guild_event_registrations
    ON CONFLICT (guild_event_id) DO UPDATE
    SET guild_event_kind = EXCLUDED.guild_event_kind,
        occurs_at_start_unix = EXCLUDED.occurs_at_start_unix,
        occurs_at_end_unix = EXCLUDED.occurs_at_end_unix,
        guild_event_title = EXCLUDED.guild_event_title,
        guild_event_destination = EXCLUDED.guild_event_destination,
        guild_event_category = EXCLUDED.guild_event_category,
        discoverable = EXCLUDED.discoverable,
        registered_at_unix = LEAST(guild_event_calendar_listings.registered_at_unix, EXCLUDED.registered_at_unix),
        updated_at_unix = GREATEST(guild_event_calendar_listings.updated_at_unix, EXCLUDED.updated_at_unix);

    UPDATE guild_event_calendar_listings AS listing
       SET guild_event_title = round.round_title
      FROM raffle_rounds AS round
     WHERE listing.guild_event_kind = 'raffle-round'
       AND listing.guild_event_id = round.round_id::text
       AND round.round_title IS NOT NULL
       AND length(btrim(round.round_title)) > 0;
  END IF;
END $$;

DROP TABLE IF EXISTS guild_event_registrations;
