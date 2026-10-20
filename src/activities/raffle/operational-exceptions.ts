import { componentLogger } from "../../core/runtime-logger.js";
import { publishOperationalRecord } from "../../operational-inspection.js";

const log = componentLogger("raffle.operational.inspection");

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
    log.error({ err: error, operation: input.operation }, "Raffle operational inspection publication failed");
  }
}
