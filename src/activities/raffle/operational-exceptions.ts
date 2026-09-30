import { publishOperationalRecord } from "../../operational-inspection.js";

export type RaffleOperationalExceptionInput = {
  operation: string;
  actorIdentityId?: string | null;
  summary: string;
  details?: Record<string, unknown> | null;
};

export async function publishRaffleOperationalException(
  input: RaffleOperationalExceptionInput,
): Promise<void> {
  try {
    await publishOperationalRecord({
      source: "raffle",
      operation: input.operation,
      kind: "exception",
      actorIdentityId: input.actorIdentityId ?? null,
      summary: input.summary,
      details: input.details ?? null,
    });
  } catch (error) {
    console.error("Raffle operational inspection publication failed", error);
  }
}
