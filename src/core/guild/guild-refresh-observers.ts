export type GuildRefreshObservation = {
  guildId: string;
  changedGuildieIds: readonly string[];
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
      console.error("Guild refresh observer failed", { guildId: observation.guildId, error });
    }
  }
}
