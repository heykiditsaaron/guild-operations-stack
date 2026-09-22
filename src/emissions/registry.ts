import { randomUUID } from "node:crypto";
import type {
  Emission,
  EmissionConsumerRegistration,
} from "./contract.js";

export const EMISSION_TRANSPORT_ID = "in-process";

type EmissionPublication = Readonly<{
  publicationId: string;
  emission: Emission;
}>;

const consumersByCode = new Map<string, Map<string, EmissionConsumerRegistration>>();

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Emission ${field} must not be empty`);
  return normalized;
}

function publish(input: Emission): EmissionPublication {
  return {
    publicationId: randomUUID(),
    emission: {
      code: requireText(input.code, "code"),
      ...(input.parent === undefined ? {} : { parent: requireText(input.parent, "parent") }),
      subject: requireText(input.subject, "subject"),
    },
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

export async function emit(input: Emission): Promise<void> {
  const publication = publish(input);

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
