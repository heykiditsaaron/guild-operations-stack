CREATE TABLE IF NOT EXISTS operational_records (
  operational_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at_unix bigint NOT NULL CHECK (occurred_at_unix >= 0),
  source text NOT NULL CHECK (length(btrim(source)) > 0),
  operation text NOT NULL CHECK (length(btrim(operation)) > 0),
  kind text NOT NULL CHECK (kind IN ('result', 'exception')),
  result text CHECK (result IN ('success', 'partial', 'failure')),
  actor_guildie_id uuid REFERENCES guildies(guildie_id) ON DELETE SET NULL,
  summary text NOT NULL CHECK (length(btrim(summary)) > 0),
  details jsonb,
  CHECK (
    (kind = 'result' AND result IS NOT NULL)
    OR (kind = 'exception' AND result IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS operational_records_occurred_idx
  ON operational_records(occurred_at_unix DESC);

CREATE INDEX IF NOT EXISTS operational_records_source_occurred_idx
  ON operational_records(source, occurred_at_unix DESC);

CREATE INDEX IF NOT EXISTS operational_records_kind_occurred_idx
  ON operational_records(kind, occurred_at_unix DESC);

INSERT INTO guild_rank_capabilities (guild_id, rank_index, capability)
SELECT guild_id, rank_index, 'operations.inspect'
  FROM guild_rank_definitions
 WHERE active = true
   AND rank_index IN (0, 1, 2)
ON CONFLICT (guild_id, rank_index, capability) DO NOTHING;
