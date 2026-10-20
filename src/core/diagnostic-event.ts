import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import { publishInspectionBestEffort } from "./operational-inspection/best-effort.js";
import { publishOperationalRecord, type PublishOperationalRecordInput } from "../operational-inspection.js";

/**
 * One diagnostic occurrence with two delivery destinations. Persistence is
 * policy-selected and best-effort; the runtime log is always attempted first.
 * Callers must supply sanitized, bounded details suitable for guild operators.
 */
export type DiagnosticEvent = PublishOperationalRecordInput & {
  severity: "info" | "warn" | "error";
  correlation?: Record<string, string | number>;
  runtimeError?: unknown;
};

export async function emitDiagnosticEvent(
  event: DiagnosticEvent,
  log: Pick<Logger, "info" | "warn" | "error">,
  persist: (record: PublishOperationalRecordInput) => Promise<unknown> = publishOperationalRecord,
): Promise<string> {
  const eventId = randomUUID();
  const { severity, correlation, runtimeError, ...record } = event;
  const context = { eventId, source: record.source, operation: record.operation, kind: record.kind,
    result: record.result, ...correlation, ...(runtimeError === undefined ? {} : { err: runtimeError }) };
  // The shared summary is the message in both views. The raw error belongs
  // only in the runtime stream; persistence receives explicitly safe details.
  try {
    log[severity](context, record.summary);
  } catch {
    // Even a broken runtime sink must not affect the owning operation.
  }
  await publishInspectionBestEffort(
    () => persist({ ...record, details: { ...record.details, eventId, severity, ...correlation } }),
    (error) => {
      try { log.error({ err: error, eventId }, "Diagnostic event persistence failed"); } catch { /* sink unavailable */ }
    },
    () => {},
  );
  return eventId;
}
