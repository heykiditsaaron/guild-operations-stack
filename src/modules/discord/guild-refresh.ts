import { registerGuildRefreshObserver } from "../../guild-refresh-observers.js";
import { discordGuildIntegrationConfigured } from "./client.js";
import { discordModuleConfiguration } from "./module-configuration.js";
import { reconcileGuildiesBestEffort } from "./roles.js";

async function observeGuildRefresh(observation: { guildId: string; changedGuildieIds: readonly string[] }): Promise<void> {
  const moduleConfiguration = await discordModuleConfiguration(observation.guildId);
  if (!moduleConfiguration.enabled || observation.changedGuildieIds.length === 0 || !await discordGuildIntegrationConfigured()) return;
  await reconcileGuildiesBestEffort([...observation.changedGuildieIds], { trigger: "guild-refresh" });
}

export function registerDiscordGuildRefreshObserver(): void {
  registerGuildRefreshObserver(observeGuildRefresh);
}
