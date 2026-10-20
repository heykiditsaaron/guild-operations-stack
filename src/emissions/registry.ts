import { componentLogger } from "../core/runtime-logger.js";
import type { PoolClient } from "pg";
import { pool } from "../db.js";
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

  for (const consumer of consumersByCode.get(emission.code)?.values() ?? []) {
    await client.query(
      `INSERT INTO emission_consumer_receipts (publication_id, consumer_id)
       VALUES ($1, $2)`,
      [publicationId, consumer.consumerId],
    );
  }

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
  const claimed = await pool.query(
    `UPDATE emission_consumer_receipts
        SET last_attempted_at_unix = extract(epoch FROM now())::bigint,
            attempt_count = attempt_count + 1
      WHERE publication_id = $1
        AND consumer_id = $2
        AND acknowledged_at_unix IS NULL
        AND (
          last_attempted_at_unix IS NULL
          OR last_attempted_at_unix <= extract(epoch FROM now())::bigint - 30
        )
      RETURNING publication_id`,
    [publication.publicationId, consumer.consumerId],
  );
  if (!claimed.rowCount) return;

  log.debug({ publicationId: publication.publicationId, consumerId: consumer.consumerId, emissionCode: publication.emission.code }, "Emission receipt claimed");

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
    log.info({ publicationId: publication.publicationId, consumerId: consumer.consumerId, emissionCode: publication.emission.code }, "Emission consumer acknowledged");
  } catch (error) {
    log.error({ err: error, transportId: EMISSION_TRANSPORT_ID, publicationId: publication.publicationId, consumerId: consumer.consumerId, emissionCode: publication.emission.code, emissionSubject: publication.emission.subject }, "Emission consumer failed; receipt remains pending");
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
