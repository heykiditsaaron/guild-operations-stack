import type { Emission } from "../../emissions/contract.js";
import { registerEmissionConsumer } from "../../emissions/registry.js";
import { discordGuildIntegrationConfigured } from "./client.js";
import { discordPluginConfiguration } from "./plugin-configuration.js";
import { reconcileGuildieDiscordRoles } from "./roles.js";



const DISCORD_GUILDIE_EMISSION_CODES = [
  "guildie.joined",
  "guildie.left",
  "guildie.rank.modified",
] as const;

async function consumeGuildieEmission(emission: Emission): Promise<void> {
  const moduleConfiguration = await discordPluginConfiguration();
  if (!moduleConfiguration.enabled || !await discordGuildIntegrationConfigured()) return;

  await reconcileGuildieDiscordRoles(emission.subject, {
    trigger: emission.code,
  });
}

export function registerDiscordEmissionConsumers(): void {
  registerEmissionConsumer({
    consumerId: "discord.roles",
    codes: DISCORD_GUILDIE_EMISSION_CODES,
    receive: consumeGuildieEmission,
  });
}
