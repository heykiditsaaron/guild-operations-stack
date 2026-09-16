DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'guild_event_publications'
      AND column_name = 'interactions'
  ) THEN
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
  END IF;
END
$$;
