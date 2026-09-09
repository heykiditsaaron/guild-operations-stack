import { registerGuildRefreshObserver } from "../../guild-refresh-observers.js";
import { ensureDiscordAdministrationCapabilities } from "./authorization.js";
import { reconcileGuildiesBestEffort } from "./roles.js";

async function observeGuildRefresh(observation: {
  guildId: string;
  changedGuildieIds: readonly string[];
}): Promise<void> {
  await ensureDiscordAdministrationCapabilities(observation.guildId);
  await reconcileGuildiesBestEffort([...observation.changedGuildieIds], { trigger: "guild-refresh" });
}

export function registerDiscordGuildRefreshObserver(): void {
  registerGuildRefreshObserver(observeGuildRefresh);
}
