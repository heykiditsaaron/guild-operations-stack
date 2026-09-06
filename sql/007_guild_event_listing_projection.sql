ALTER TABLE guild_event_registrations
  ADD COLUMN IF NOT EXISTS guild_event_title text
    CHECK (guild_event_title IS NULL OR length(btrim(guild_event_title)) > 0),
  ADD COLUMN IF NOT EXISTS guild_event_destination text
    CHECK (guild_event_destination IS NULL OR length(btrim(guild_event_destination)) > 0);

UPDATE guild_event_registrations
   SET guild_event_title = COALESCE(guild_event_title, 'Guild Raffle'),
       guild_event_destination = COALESCE(guild_event_destination, '/events/raffle')
 WHERE guild_event_kind = 'raffle-round';
