import type { Emission } from "../../emissions/contract.js";
import { registerEmissionConsumer } from "../../emissions/registry.js";
import { discordGuildIntegrationConfigured } from "./client.js";
import { discordModuleConfiguration } from "./module-configuration.js";
import { reconcileGuildieDiscordRoles } from "./roles.js";

const DISCORD_GUILDIE_EMISSION_CODES = [
  "guildie.joined",
  "guildie.left",
  "guildie.rank.modified",
] as const;

async function consumeGuildieEmission(emission: Emission): Promise<void> {
  const moduleConfiguration = await discordModuleConfiguration();
  if (!moduleConfiguration.enabled || !await discordGuildIntegrationConfigured()) return;

  await reconcileGuildieDiscordRoles(emission.subject, {
    trigger: emission.code,
  });
}

export function registerDiscordEmissionConsumers(): void {
  registerEmissionConsumer(DISCORD_GUILDIE_EMISSION_CODES, consumeGuildieEmission);
}
