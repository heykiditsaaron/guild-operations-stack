CREATE TABLE activity_records (
  activity_kind text NOT NULL,
  activity_id text NOT NULL,
  occurrence jsonb NOT NULL,
  frozen_at_unix bigint NOT NULL CHECK (frozen_at_unix >= 0),
  PRIMARY KEY (activity_kind, activity_id),
  CHECK (jsonb_typeof(occurrence) = 'object'),
  CHECK (occurrence->>'phase' = 'record')
);

CREATE INDEX activity_records_frozen_idx
  ON activity_records (frozen_at_unix DESC);
