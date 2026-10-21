import type { FastifyBaseLogger } from "fastify";
import { performGuildRefresh } from "./guild-refresh-operation.js";
import { claimDueGuildRefresh } from "./core/guild/guild-refresh-schedule.js";

const SCHEDULER_POLL_MILLISECONDS = 5000;

export function startGuildRefreshScheduler(logger: FastifyBaseLogger, ready: () => Promise<boolean> = async () => true): () => void {
  let stopped = false;
  let running = false;
  let timer: NodeJS.Timeout | null = null;

  const scheduleNextCheck = (): void => {
    if (stopped) return;
    timer = setTimeout(() => void tick(), SCHEDULER_POLL_MILLISECONDS);
    timer.unref();
  };

  const tick = async (): Promise<void> => {
    if (stopped || running) {
      scheduleNextCheck();
      return;
    }

    running = true;
    try {
      if (!await ready()) return;
      const claimed = await claimDueGuildRefresh();
      if (!claimed) return;

      logger.info(
        { nextDueAtUnix: claimed.nextDueAtUnix, intervalSeconds: claimed.intervalSeconds },
        "Automatic guild refresh started",
      );

      try {
        const result = await performGuildRefresh({
          onInspectionFailure: (error) => {
            logger.error({ err: error }, "Operational inspection publication failed for automatic guild refresh");
          },
        });
        logger.info(
          { guildId: result.guildId, rosterCount: result.rosterCount, nextDueAtUnix: claimed.nextDueAtUnix },
          "Automatic guild refresh completed",
        );
      } catch (error) {
        logger.error({ err: error, nextDueAtUnix: claimed.nextDueAtUnix }, "Automatic guild refresh failed");
      }
    } catch (error) {
      logger.error({ err: error }, "Automatic guild refresh scheduler check failed");
    } finally {
      running = false;
      scheduleNextCheck();
    }
  };

  void tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
