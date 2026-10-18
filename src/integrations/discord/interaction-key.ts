import { discordIntegrationConfiguration } from "./configuration.js";

let key: string | null = null;

export function cacheDiscordInteractionPublicKey(value: string | null): void {
  key = value && /^[0-9a-f]{64}$/i.test(value) ? value : null;
}

export function discordInteractionPublicKey(): string | null {
  return key;
}

export async function loadDiscordInteractionPublicKey(): Promise<void> {
  const config = await discordIntegrationConfiguration();
  cacheDiscordInteractionPublicKey(config?.enabled && config.applicationVerifiedAt ? config.interactionPublicKey : null);
}
