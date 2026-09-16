ALTER TABLE guild_event_publications
  RENAME COLUMN interactions TO destinations;

UPDATE guild_event_publications
SET destinations = COALESCE((
  SELECT jsonb_agg(
    jsonb_build_object(
      'kind', value->>'kind',
      'label', value->>'label',
      'href', value->>'destination'
    )
  )
  FROM jsonb_array_elements(destinations) AS value
), '[]'::jsonb);
