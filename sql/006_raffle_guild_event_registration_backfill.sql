INSERT INTO guild_event_registrations (
  guild_event_id,
  guild_event_kind,
  occurs_at_start_unix,
  occurs_at_end_unix,
  guild_event_category,
  discoverable,
  registered_at_unix,
  updated_at_unix
)
SELECT
  round_id::text,
  'raffle-round',
  CASE
    WHEN live_at IS NOT NULL THEN floor(extract(epoch FROM live_at))::bigint
    ELSE drawing_at_unix
  END,
  CASE
    WHEN live_at IS NULL THEN NULL
    WHEN concluded_at IS NOT NULL THEN floor(extract(epoch FROM concluded_at))::bigint
    ELSE drawing_at_unix
  END,
  'raffle',
  NOT (status = 'admin_cancelled' AND live_at IS NULL),
  floor(extract(epoch FROM now()))::bigint,
  floor(extract(epoch FROM now()))::bigint
FROM raffle_rounds
ON CONFLICT (guild_event_id) DO NOTHING;
