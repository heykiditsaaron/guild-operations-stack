import { componentLogger } from "../runtime-logger.js";

const log = componentLogger("guild.refresh.observers");

export type GuildRefreshObservation = {
  guildId: string;
  changedIdentityIds: readonly string[];
};

export type GuildRefreshObserver = (observation: GuildRefreshObservation) => Promise<void>;

const observers: GuildRefreshObserver[] = [];

export function registerGuildRefreshObserver(observer: GuildRefreshObserver): void {
  if (observers.includes(observer)) return;
  observers.push(observer);
}

export async function publishGuildRefreshObservation(observation: GuildRefreshObservation): Promise<void> {
  for (const observer of observers) {
    try {
      await observer(observation);
    } catch (error) {
      log.error({ err: error, guildId: observation.guildId }, "Guild refresh observer failed");
    }
  }
}
