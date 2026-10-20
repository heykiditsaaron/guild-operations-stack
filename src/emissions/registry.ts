import { componentLogger } from "../core/runtime-logger.js";
import type { PoolClient } from "pg";
import { pool } from "../db.js";
import { claimEmissionReceipt } from "./receipt-claim.js";
import type {
  Emission,
  EmissionConsumerRegistration,
} from "./contract.js";

const log = componentLogger("emissions.transport");

export const EMISSION_TRANSPORT_ID = "in-process";

export type EmissionPublication = Readonly<{
  publicationId: string;
  emission: Emission;
}>;

const consumersByCode = new Map<string, Map<string, EmissionConsumerRegistration>>();

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Emission ${field} must not be empty`);
  return normalized;
}

function normalizeEmission(input: Emission): Emission {
  return {
    code: requireText(input.code, "code"),
    ...(input.parent === undefined ? {} : { parent: requireText(input.parent, "parent") }),
    subject: requireText(input.subject, "subject"),
  };
}

export async function publishEmission(
  client: PoolClient,
  input: Emission,
): Promise<EmissionPublication> {
  const emission = normalizeEmission(input);
  const result = await client.query<{ publication_id: string }>(
    `INSERT INTO emission_publications (transport_id, code, parent, subject)
     VALUES ($1, $2, $3, $4)
     RETURNING publication_id`,
    [EMISSION_TRANSPORT_ID, emission.code, emission.parent ?? null, emission.subject],
  );
  const publicationId = result.rows[0].publication_id;

  const consumers = [...(consumersByCode.get(emission.code)?.values() ?? [])];
  for (const consumer of consumers) {
    await client.query(
      `INSERT INTO emission_consumer_receipts (publication_id, consumer_id)
       VALUES ($1, $2)`,
      [publicationId, consumer.consumerId],
    );
  }

  // This transaction may still roll back; do not describe staging as committed delivery.
  log.debug({ publicationId, emissionCode: emission.code, intendedConsumerCount: consumers.length }, "Emission publication staged in transaction");
  return { publicationId, emission };
}

export function registerEmissionConsumer(
  input: EmissionConsumerRegistration,
): void {
  const consumerId = requireText(input.consumerId, "consumerId");

  for (const codeInput of input.codes) {
    const code = requireText(codeInput, "code");
    const consumers = consumersByCode.get(code) ?? new Map<string, EmissionConsumerRegistration>();
    const existing = consumers.get(consumerId);

    if (existing && existing.receive !== input.receive) {
      throw new Error(`Emission consumer ${consumerId} is already registered for ${code}`);
    }

    consumers.set(consumerId, {
      consumerId,
      codes: input.codes,
      receive: input.receive,
    });
    consumersByCode.set(code, consumers);
  }
}

async function attemptConsumerReceipt(
  publication: EmissionPublication,
  consumer: EmissionConsumerRegistration,
): Promise<void> {
  const attemptCount = await claimEmissionReceipt(
    (sql, values) => pool.query<{ attempt_count: number }>(sql, values),
    publication.publicationId,
    consumer.consumerId,
  );
  if (attemptCount === null) return;

  const trace = { publicationId: publication.publicationId, consumerId: consumer.consumerId, emissionCode: publication.emission.code, attemptCount };
  log.info(trace, "Emission delivery attempt started");

  try {
    await consumer.receive(publication.emission);
    await pool.query(
      `UPDATE emission_consumer_receipts
          SET acknowledged_at_unix = extract(epoch FROM now())::bigint
        WHERE publication_id = $1
          AND consumer_id = $2
          AND acknowledged_at_unix IS NULL`,
      [publication.publicationId, consumer.consumerId],
    );
    log.info(trace, "Emission consumer acknowledged");
  } catch (error) {
    log.error({ err: error, ...trace, transportId: EMISSION_TRANSPORT_ID }, "Emission consumer failed; receipt remains pending");
  }
}

export async function deliverEmission(publication: EmissionPublication): Promise<void> {
  const intended = await pool.query<{ consumer_id: string }>(
    `SELECT consumer_id
       FROM emission_consumer_receipts
      WHERE publication_id = $1
        AND acknowledged_at_unix IS NULL
      ORDER BY consumer_id`,
    [publication.publicationId],
  );

  for (const receipt of intended.rows) {
    const consumer = consumersByCode.get(publication.emission.code)?.get(receipt.consumer_id);
    if (!consumer) continue;
    await attemptConsumerReceipt(publication, consumer);
  }
}

export async function recoverPendingEmissions(): Promise<void> {
  const pending = await pool.query<{
    publication_id: string;
    code: string;
    parent: string | null;
    subject: string;
  }>(
    `SELECT DISTINCT p.publication_id, p.code, p.parent, p.subject, p.published_at_unix
       FROM emission_publications p
       JOIN emission_consumer_receipts r ON r.publication_id = p.publication_id
      WHERE r.acknowledged_at_unix IS NULL
      ORDER BY p.published_at_unix, p.publication_id`,
  );

  for (const row of pending.rows) {
    await deliverEmission({
      publicationId: row.publication_id,
      emission: {
        code: row.code,
        ...(row.parent === null ? {} : { parent: row.parent }),
        subject: row.subject,
      },
    });
  }
}
