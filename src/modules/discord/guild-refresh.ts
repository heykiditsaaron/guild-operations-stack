import { registerGuildRefreshObserver } from "../../guild-refresh-observers.js";
import { reconcileGuildiesBestEffort } from "../../guildie-discord/roles.js";
import { ensureDiscordAdministrationCapabilities } from "./authorization.js";

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
