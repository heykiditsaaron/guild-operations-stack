import type { Emission, EmissionConsumer } from "./contract.js";

const consumersByCode = new Map<string, Set<EmissionConsumer>>();

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Emission ${field} must not be empty`);
  return normalized;
}

export function registerEmissionConsumer(
  codes: readonly string[],
  consumer: EmissionConsumer,
): void {
  for (const codeInput of codes) {
    const code = requireText(codeInput, "code");
    const consumers = consumersByCode.get(code) ?? new Set<EmissionConsumer>();
    consumers.add(consumer);
    consumersByCode.set(code, consumers);
  }
}

export async function emit(input: Emission): Promise<void> {
  const emission: Emission = {
    code: requireText(input.code, "code"),
    ...(input.parent === undefined ? {} : { parent: requireText(input.parent, "parent") }),
    subject: requireText(input.subject, "subject"),
  };

  for (const consumer of consumersByCode.get(emission.code) ?? []) {
    try {
      await consumer(emission);
    } catch (error) {
      console.error("Emission consumer failed", { emission, error });
    }
  }
}
