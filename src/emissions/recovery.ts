import type { FastifyBaseLogger } from "fastify";
import { recoverPendingEmissions } from "./registry.js";

const RECOVERY_INTERVAL_MS = 30_000;

/** Prevent overlapping recovery passes in this process while preserving retry after failure. */
export function createEmissionRecoveryCycle(
  recoverPending: () => Promise<void>,
  log: Pick<FastifyBaseLogger, "error">,
): () => Promise<void> {
  let running = false;

  return async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await recoverPending();
    } catch (error) {
      log.error({ err: error }, "Emission recovery failed");
    } finally {
      running = false;
    }
  };
}

export function startEmissionRecovery(log: FastifyBaseLogger): () => void {
  const recover = createEmissionRecoveryCycle(recoverPendingEmissions, log);
  void recover();
  const timer = setInterval(() => void recover(), RECOVERY_INTERVAL_MS);
  return () => clearInterval(timer);
}
