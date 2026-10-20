import { componentLogger } from "./core/runtime-logger.js";
import { pool } from "./db.js";
import { recoverPendingEmissions } from "./emissions/registry.js";
import { readdir } from "node:fs/promises";
import { requireOperationalInstallationGuildBinding } from "./core/installation/guild-binding.js";
import { reconcileAssociatedDiscordRoles } from "./integrations/discord/role-sync-cycle.js";
import { installationSecretKey } from "./core/installation-secret.js";
import { discordEncryptedSecretsExist, discordIntegrationConfiguration, establishDiscordGuildBinding } from "./integrations/discord/configuration.js";
import { verifiedDiscordServer } from "./integrations/discord/api.js";
import { installationBlizzardEncryptedSecretExists } from "./core/installation/blizzard-configuration.js";
import { DiscordGateway } from "./integrations/discord/gateway.js";

installationSecretKey({ encryptedDataExists: await installationBlizzardEncryptedSecretExists() || await discordEncryptedSecretsExist() });

// The Discord worker is a separate process from the web server. Register interaction
// handlers here as well; the web process's in-memory registry is not shared.
const activityEntries = await readdir(new URL("./activities/", import.meta.url), { withFileTypes: true });
for (const entry of activityEntries.filter((item) => item.isDirectory())) {
  const loaded = await import(`./activities/${entry.name}/plugin.js`) as {
    activityPlugin?: { registerDiscordInteractions?: () => void };
  };
  loaded.activityPlugin?.registerDiscordInteractions?.();
}

const log = componentLogger("discord.worker");

let stopping = false;
let lastState = "";
let gateway: DiscordGateway | null = null;
let gatewayToken = "";
let roleSyncOffset = 0;
let roleSyncBusy = false;

async function inspectDiscordState(): Promise<void> {
  const configuration = await discordIntegrationConfiguration();
  if (configuration?.enabled && configuration.applicationVerifiedAt && !configuration.discordGuildId) {
    try {
      const server = await verifiedDiscordServer(configuration);
      await establishDiscordGuildBinding(server.id);
      log.info({ discordGuildId: server.id, discordGuildName: server.name }, "Discord Integration established server binding");
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "discord_server_not_found") {
        log.error({ err: error }, "Discord Integration server verification failed");
      }
    }
  }
  const refreshedConfiguration = await discordIntegrationConfiguration();
  const state = !refreshedConfiguration
    ? "unconfigured"
    : !refreshedConfiguration.enabled
      ? "disabled"
      : refreshedConfiguration.discordGuildId
        ? "ready"
        : "awaiting_server_authorization";
  if (state === "ready") {
    if (!gateway || gatewayToken !== refreshedConfiguration!.botToken) {
      gateway?.stop();
      gatewayToken = refreshedConfiguration!.botToken;
      gateway = new DiscordGateway(gatewayToken, (health) => log.info({ health }, "Discord Gateway runtime health changed"));
      gateway.start();
    }
  } else if (gateway) {
    gateway.stop();
    gateway = null;
    gatewayToken = "";
  }
  if (state !== lastState) {
    log.info({ state }, "Discord Integration process state changed");
    lastState = state;
  }
}

async function syncDiscordRoles(): Promise<void> {
  if (stopping || roleSyncBusy) return;
  roleSyncBusy = true;
  try {
    const config = await discordIntegrationConfiguration();
    if (!config?.enabled || !config.applicationVerifiedAt || !config.discordGuildId) {
      roleSyncOffset = 0;
      return;
    }
    const binding = await requireOperationalInstallationGuildBinding();
    const outcome = await reconcileAssociatedDiscordRoles({
      configuration: config, guildId: binding.guildId, offset: roleSyncOffset, limit: 10,
    });
    roleSyncOffset = outcome.nextOffset;
    if (outcome.updated || outcome.failures) log.info({ outcome }, "Discord rank role synchronization completed");
  } finally {
    roleSyncBusy = false;
  }
}
await inspectDiscordState();
void recoverPendingEmissions().catch((error) => log.error({ err: error }, "Discord emission recovery failed"));
const timer = setInterval(() => void inspectDiscordState().catch((error) => {
  log.error({ err: error }, "Discord Integration state inspection failed");
}), 30_000);

const emissionTimer = setInterval(() => {
  void recoverPendingEmissions().catch((error) => log.error({ err: error }, "Discord emission recovery failed"));
}, 30_000);

const roleTimer = setInterval(() => {
  void syncDiscordRoles().catch((error) => log.error({ err: error }, "Discord role sync failed"));
}, 120_000);
void syncDiscordRoles().catch((error) => log.error({ err: error }, "Discord role sync startup failed"));

async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  clearInterval(roleTimer);
  clearInterval(emissionTimer);
  gateway?.stop();
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
