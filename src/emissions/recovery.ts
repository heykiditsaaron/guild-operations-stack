import type { FastifyBaseLogger } from "fastify";
import { recoverPendingEmissions } from "./registry.js";

const RECOVERY_INTERVAL_MS = 30_000;

export function startEmissionRecovery(log: FastifyBaseLogger): () => void {
  let running = false;

  const recover = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await recoverPendingEmissions();
    } catch (error) {
      log.error({ err: error }, "Emission recovery failed");
    } finally {
      running = false;
    }
  };

  void recover();
  const timer = setInterval(() => void recover(), RECOVERY_INTERVAL_MS);
  return () => clearInterval(timer);
}
