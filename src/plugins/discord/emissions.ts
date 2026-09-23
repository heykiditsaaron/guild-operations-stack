import type { Emission } from "../../emissions/contract.js";
import { registerEmissionConsumer } from "../../emissions/registry.js";
import { createDiscordChannelMessage, editDiscordChannelMessage, discordGuildIntegrationConfigured } from "./client.js";
import { discordPluginConfiguration } from "./plugin-configuration.js";
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
  const moduleConfiguration = await discordPluginConfiguration();
  if (!moduleConfiguration.enabled || !await discordGuildIntegrationConfigured()) return;

  await reconcileGuildieDiscordRoles(emission.subject, {
    trigger: emission.code,
  });
}

const DISCORD_RAID_RECONCILIATION_CODES = [
  "raid.modified",
  "raid.cancelled",
  "raid.signup.established",
  "raid.signup.revoked",
  "raid.signup.denied",
  "raid.assignment.established",
  "raid.assignment.modified",
  "raid.assignment.withdrawn",
] as const;

async function consumeRaidEstablishedEmission(emission: Emission): Promise<void> {
  const moduleConfiguration = await discordPluginConfiguration();
  if (!moduleConfiguration.enabled || !await discordGuildIntegrationConfigured()) return;

  const existing = await discordRaidProjectionCoordinate(emission.subject);
  if (existing) {
    const state = await discordRaidProjectionState(emission.subject);
    if (state) await editDiscordChannelMessage(existing.channelId, existing.messageId, renderDiscordRaidProjection(state));
    return;
  }

  const projectionConfiguration = await discordRaidProjectionConfiguration();
  if (!projectionConfiguration.channelId) return;
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

async function consumeRaidReconciliationEmission(emission: Emission): Promise<void> {
  const moduleConfiguration = await discordPluginConfiguration();
  if (!moduleConfiguration.enabled || !await discordGuildIntegrationConfigured()) return;

  const coordinate = await discordRaidProjectionCoordinate(emission.subject);
  if (!coordinate) return;
  const state = await discordRaidProjectionState(emission.subject, emission.code === "raid.cancelled");
  if (!state) return;

  await editDiscordChannelMessage(
    coordinate.channelId,
    coordinate.messageId,
    renderDiscordRaidProjection(state),
  );
}

export function registerDiscordEmissionConsumers(): void {
  registerEmissionConsumer({
    consumerId: "discord.roles",
    codes: DISCORD_GUILDIE_EMISSION_CODES,
    receive: consumeGuildieEmission,
  });
  registerEmissionConsumer({
    consumerId: "discord.raid-projection-establish",
    codes: ["raid.established"],
    receive: consumeRaidEstablishedEmission,
  });
  registerEmissionConsumer({
    consumerId: "discord.raid-projection-reconcile",
    codes: DISCORD_RAID_RECONCILIATION_CODES,
    receive: consumeRaidReconciliationEmission,
  });
}
