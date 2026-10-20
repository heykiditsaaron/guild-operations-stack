import type { Emission } from "./contract.js";

/** Distinguish a consumer failure from failure to persist its successful acknowledgment. */
export async function completeEmissionAttempt(
  receive: (emission: Emission) => Promise<void>,
  emission: Emission,
  acknowledge: () => Promise<void>,
  log: { info: (fields: Record<string, unknown>, message: string) => void; error: (fields: Record<string, unknown>, message: string) => void },
  trace: Record<string, unknown>,
): Promise<void> {
  try {
    await receive(emission);
  } catch (error) {
    log.error({ err: error, ...trace }, "Emission consumer failed; receipt remains pending");
    return;
  }

  try {
    await acknowledge();
    log.info(trace, "Emission consumer acknowledged");
  } catch (error) {
    log.error({ err: error, ...trace }, "Emission acknowledgment persistence failed; receipt remains pending and consumer may have completed");
  }
}
