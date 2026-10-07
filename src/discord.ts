import { pool } from "./db.js";
import { installationSecretKey } from "./core/installation-secret.js";
import { discordEncryptedSecretsExist, discordIntegrationConfiguration } from "./integrations/discord/configuration.js";
import { installationBlizzardEncryptedSecretExists } from "./core/installation/blizzard-configuration.js";

installationSecretKey({ encryptedDataExists: await installationBlizzardEncryptedSecretExists() || await discordEncryptedSecretsExist() });

let stopping = false;
let lastState = "";

async function inspectDiscordState(): Promise<void> {
  const configuration = await discordIntegrationConfiguration();
  const state = !configuration
    ? "unconfigured"
    : !configuration.enabled
      ? "disabled"
      : configuration.discordGuildId
        ? "ready"
        : "awaiting_server_authorization";
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
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
