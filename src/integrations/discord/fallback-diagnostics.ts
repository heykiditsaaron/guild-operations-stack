/** Observe a best-effort Discord failure response without replacing the original error. */
export async function observeDiscordFallback(
  delivery: Promise<{ ok: boolean; status: number }>,
  log: { warn: (fields: Record<string, unknown>, message: string) => void },
  context: { interactionId: string; interactionKind?: string },
  rejectedMessage: string,
  deliveryFailureMessage: string,
): Promise<void> {
  try {
    const response = await delivery;
    if (!response.ok) {
      log.warn({ ...context, status: response.status }, rejectedMessage);
    }
  } catch (error) {
    log.warn({ ...context, err: error }, deliveryFailureMessage);
  }
}
