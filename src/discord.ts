import { pool } from "./db.js";
import { installationSecretKey } from "./core/installation-secret.js";
import { discordEncryptedSecretsExist, discordIntegrationConfiguration, establishDiscordGuildBinding } from "./integrations/discord/configuration.js";
import { verifiedDiscordServer } from "./integrations/discord/api.js";
import { installationBlizzardEncryptedSecretExists } from "./core/installation/blizzard-configuration.js";
import { DiscordGateway } from "./integrations/discord/gateway.js";

installationSecretKey({ encryptedDataExists: await installationBlizzardEncryptedSecretExists() || await discordEncryptedSecretsExist() });

let stopping = false;
let lastState = "";
let gateway: DiscordGateway | null = null;
let gatewayToken = "";

async function inspectDiscordState(): Promise<void> {
  const configuration = await discordIntegrationConfiguration();
  if (configuration?.enabled && configuration.applicationVerifiedAt && !configuration.discordGuildId) {
    try {
      const server = await verifiedDiscordServer(configuration);
      await establishDiscordGuildBinding(server.id);
      console.log(`Discord Integration established server binding: ${server.name} (${server.id})`);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "discord_server_not_found") {
        console.error("Discord Integration server verification failed", error);
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
      gateway = new DiscordGateway(gatewayToken, (health) => console.log(`Discord Gateway runtime health: ${health}`));
      gateway.start();
    }
  } else if (gateway) {
    gateway.stop();
    gateway = null;
    gatewayToken = "";
  }
  if (state !== lastState) {
    console.log(`Discord Integration process state: ${state}`);
    lastState = state;
  }
}

await inspectDiscordState();
const timer = setInterval(() => void inspectDiscordState().catch((error) => {
  console.error("Discord Integration state inspection failed", error);
}), 30_000);

async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  gateway?.stop();
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
