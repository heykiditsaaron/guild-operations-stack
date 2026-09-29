import type { PoolClient } from "pg";
import { pool } from "../../db.js";
import type { ActivityOccurrence } from "./registry.js";

export type ActivityRecord = {
  activityKind: string;
  activityId: string;
  occurrence: ActivityOccurrence;
  frozenAtUnix: number;
};

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Activity Record ${field} is required`);
  return normalized;
}

export async function freezeActivityOccurrence(
  client: PoolClient,
  occurrence: ActivityOccurrence,
  frozenAtUnix: number,
): Promise<ActivityRecord> {
  const activityKind = requiredText(occurrence.activityKind, "kind");
  const activityId = requiredText(occurrence.activityId, "id");
  if (occurrence.phase !== "record") throw new Error("Only a concluded Activity Occurrence can be frozen as a Record");
  if (!Number.isSafeInteger(frozenAtUnix) || frozenAtUnix < 0) throw new Error("Activity Record freeze time must be a non-negative integer");

  const result = await client.query<{ occurrence: ActivityOccurrence; frozen_at_unix: string }>(
    `INSERT INTO activity_records (activity_kind, activity_id, occurrence, frozen_at_unix)
     VALUES ($1,$2,$3::jsonb,$4)
     ON CONFLICT (activity_kind, activity_id) DO NOTHING
     RETURNING occurrence,frozen_at_unix`,
    [activityKind, activityId, JSON.stringify(occurrence), frozenAtUnix],
  );
  if (!result.rowCount) throw new Error(`Activity Record ${activityKind}/${activityId} is already frozen`);
  return { activityKind, activityId, occurrence: result.rows[0].occurrence, frozenAtUnix: Number(result.rows[0].frozen_at_unix) };
}

export async function activityRecord(activityKindInput: string, activityIdInput: string): Promise<ActivityRecord | null> {
  const activityKind = requiredText(activityKindInput, "kind");
  const activityId = requiredText(activityIdInput, "id");
  const result = await pool.query<{ occurrence: ActivityOccurrence; frozen_at_unix: string }>(
    "SELECT occurrence,frozen_at_unix FROM activity_records WHERE activity_kind=$1 AND activity_id=$2",
    [activityKind, activityId],
  );
  const row = result.rows[0];
  return row ? { activityKind, activityId, occurrence: row.occurrence, frozenAtUnix: Number(row.frozen_at_unix) } : null;
}
