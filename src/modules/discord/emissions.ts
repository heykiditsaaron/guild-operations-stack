import type { Emission } from "../../emissions/contract.js";
import { registerEmissionConsumer } from "../../emissions/registry.js";
import { createDiscordChannelMessage, discordGuildIntegrationConfigured } from "./client.js";
import { discordModuleConfiguration } from "./module-configuration.js";
import { reconcileGuildieDiscordRoles } from "./roles.js";
import {
  discordRaidProjectionConfiguration,
  discordRaidProjectionCoordinate,
  recordDiscordRaidProjection,
} from "./raid-projection.js";
import { discordRaidProjectionState, renderDiscordRaidProjection } from "./raid-renderer.js";

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

async function consumeRaidEstablishedEmission(emission: Emission): Promise<void> {
  const moduleConfiguration = await discordModuleConfiguration();
  if (!moduleConfiguration.enabled || !await discordGuildIntegrationConfigured()) return;

  const projectionConfiguration = await discordRaidProjectionConfiguration();
  if (!projectionConfiguration.channelId) return;
  if (await discordRaidProjectionCoordinate(emission.subject)) return;

  const state = await discordRaidProjectionState(emission.subject);
  if (!state) return;

  const message = await createDiscordChannelMessage(
    projectionConfiguration.channelId,
    renderDiscordRaidProjection(state),
  );
  await recordDiscordRaidProjection({
    raidId: state.raid.raidId,
    guildId: state.raid.guildId,
    channelId: projectionConfiguration.channelId,
    messageId: message.id,
  });
}

export function registerDiscordEmissionConsumers(): void {
  registerEmissionConsumer({
    consumerId: "discord.roles",
    codes: DISCORD_GUILDIE_EMISSION_CODES,
    receive: consumeGuildieEmission,
  });
  registerEmissionConsumer({
    consumerId: "discord.raid-projection",
    codes: ["raid.established"],
    receive: consumeRaidEstablishedEmission,
  });
}
