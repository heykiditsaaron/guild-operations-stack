import { pool } from "./db.js";
import { componentLogger } from "./core/runtime-logger.js";

const log = componentLogger("operational.inspection");

export type OperationalRecordKind = "result" | "exception";
export type OperationalResult = "success" | "partial" | "failure";

export type OperationalRecord = {
  operationalRecordId: string;
  occurredAtUnix: number;
  source: string;
  operation: string;
  kind: OperationalRecordKind;
  result: OperationalResult | null;
  actorIdentityId: string | null;
  summary: string;
  details: Record<string, unknown> | null;
};

export type PublishOperationalRecordInput = {
  source: string;
  operation: string;
  kind: OperationalRecordKind;
  result?: OperationalResult;
  actorIdentityId?: string | null;
  summary: string;
  details?: Record<string, unknown> | null;
};

export type ListOperationalRecordsInput = {
  source?: string;
  kind?: OperationalRecordKind;
  limit?: number;
};

function nonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} must not be empty`);
  return normalized;
}

function validatePublishInput(input: PublishOperationalRecordInput): void {
  nonEmpty(input.source, "source");
  nonEmpty(input.operation, "operation");
  nonEmpty(input.summary, "summary");

  if (input.kind === "result" && input.result === undefined) {
    throw new Error("result records require a result classification");
  }

  if (input.kind === "exception" && input.result !== undefined) {
    throw new Error("exception records must not include a result classification");
  }
}

function mapRecord(row: {
  operational_record_id: string;
  occurred_at_unix: string | number;
  source: string;
  operation: string;
  kind: OperationalRecordKind;
  result: OperationalResult | null;
  actor_identity_id: string | null;
  summary: string;
  details: Record<string, unknown> | null;
}): OperationalRecord {
  return {
    operationalRecordId: row.operational_record_id,
    occurredAtUnix: Number(row.occurred_at_unix),
    source: row.source,
    operation: row.operation,
    kind: row.kind,
    result: row.result,
    actorIdentityId: row.actor_identity_id,
    summary: row.summary,
    details: row.details,
  };
}

export async function publishOperationalRecord(
  input: PublishOperationalRecordInput,
): Promise<OperationalRecord> {
  validatePublishInput(input);

  const occurredAtUnix = Math.floor(Date.now() / 1000);
  const result = await pool.query<{
    operational_record_id: string;
    occurred_at_unix: string | number;
    source: string;
    operation: string;
    kind: OperationalRecordKind;
    result: OperationalResult | null;
    actor_identity_id: string | null;
    summary: string;
    details: Record<string, unknown> | null;
  }>(
    `INSERT INTO operational_records (
       occurred_at_unix,
       source,
       operation,
       kind,
       result,
       actor_identity_id,
       summary,
       details
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING operational_record_id, occurred_at_unix, source, operation, kind,
               result, actor_identity_id, summary, details`,
    [
      occurredAtUnix,
      input.source.trim(),
      input.operation.trim(),
      input.kind,
      input.result ?? null,
      input.actorIdentityId ?? null,
      input.summary.trim(),
      input.details ?? null,
    ],
  );

  const record = mapRecord(result.rows[0]);
  // The persisted record ID is the shared lookup coordinate between
  // operator inspection and container diagnostics. Never log producer details.
  log.info({
    operationalRecordId: record.operationalRecordId,
    source: record.source,
    operation: record.operation,
    kind: record.kind,
    result: record.result,
  }, "Operational record persisted");
  return record;
}

export async function listOperationalRecords(
  input: ListOperationalRecordsInput = {},
): Promise<OperationalRecord[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (input.source !== undefined) {
    const source = nonEmpty(input.source, "source");
    values.push(source);
    conditions.push(`source = $${values.length}`);
  }

  if (input.kind !== undefined) {
    values.push(input.kind);
    conditions.push(`kind = $${values.length}`);
  }

  const requestedLimit = input.limit ?? 100;
  const limit = Math.max(1, Math.min(Math.trunc(requestedLimit), 100));
  values.push(limit);

  const result = await pool.query<{
    operational_record_id: string;
    occurred_at_unix: string | number;
    source: string;
    operation: string;
    kind: OperationalRecordKind;
    result: OperationalResult | null;
    actor_identity_id: string | null;
    summary: string;
    details: Record<string, unknown> | null;
  }>(
    `SELECT operational_record_id, occurred_at_unix, source, operation, kind,
            result, actor_identity_id, summary, details
       FROM operational_records
       ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY occurred_at_unix DESC, operational_record_id DESC
      LIMIT $${values.length}`,
    values,
  );

  return result.rows.map(mapRecord);
}
