import type { PoolClient } from "pg";
import type {
  Emission,
  EmissionConsumerRegistration,
} from "./contract.js";

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

  return {
    publicationId: result.rows[0].publication_id,
    emission,
  };
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

export async function deliverEmission(publication: EmissionPublication): Promise<void> {
  for (const consumer of consumersByCode.get(publication.emission.code)?.values() ?? []) {
    try {
      await consumer.receive(publication.emission);
    } catch (error) {
      console.error("Emission consumer failed", {
        transportId: EMISSION_TRANSPORT_ID,
        publicationId: publication.publicationId,
        consumerId: consumer.consumerId,
        emission: publication.emission,
        error,
      });
    }
  }
}

