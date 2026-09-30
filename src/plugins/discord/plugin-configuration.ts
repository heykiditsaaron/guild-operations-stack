import { requireOperationalInstallationGuildBinding } from "../../core/installation/guild-binding.js";
import { installationAbsoluteUrl } from "../../core/installation/public-origin.js";
import { pool } from "../../db.js";
import { decryptSecret, encryptSecret } from "./secrets.js";

export type DiscordPluginConfiguration = {
  guildId: string;
  enabled: boolean;
  clientId: string | null;
  clientSecretConfigured: boolean;
  discordGuildId: string | null;
  botTokenConfigured: boolean;
  inviteUrl: string | null;
};

export type DiscordPluginRuntimeConfiguration = DiscordPluginConfiguration & {
  clientSecret: string | null;
  botToken: string | null;
};

export type UpdateDiscordPluginConfigurationInput = {
  clientId: string | null;
  discordGuildId: string | null;
  inviteUrl: string | null;
  clientSecret?: string | null;
  botToken?: string | null;
};

function optionalText(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function optionalHttpUrl(value: string | null): string | null {
  const normalized = optionalText(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Discord invite URL must use http or https");
  }
  return url.toString();
}

async function row(guildId: string): Promise<{
  client_id: string | null;
  client_secret_ciphertext: string | null;
  discord_guild_id: string | null;
  bot_token_ciphertext: string | null;
  invite_url: string | null;
} | null> {
  const result = await pool.query<{
    client_id: string | null;
    client_secret_ciphertext: string | null;
    discord_guild_id: string | null;
    bot_token_ciphertext: string | null;
    invite_url: string | null;
  }>(
    `SELECT client_id, client_secret_ciphertext, discord_guild_id, bot_token_ciphertext, invite_url
       FROM discord_module_settings
      WHERE guild_id = $1`,
    [guildId],
  );
  return result.rows[0] ?? null;
}

export async function discordEncryptedSecretsExist(): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM discord_module_settings
        WHERE client_secret_ciphertext IS NOT NULL
           OR bot_token_ciphertext IS NOT NULL
     ) AS exists`,
  );
  return result.rows[0]?.exists ?? false;
}

export async function discordPluginConfiguration(
  guildId?: string,
): Promise<DiscordPluginConfiguration> {
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  const current = await row(resolvedGuildId);
  return {
    guildId: resolvedGuildId,
    enabled: false,
    clientId: current?.client_id ?? null,
    clientSecretConfigured: Boolean(current?.client_secret_ciphertext),
    discordGuildId: current?.discord_guild_id ?? null,
    botTokenConfigured: Boolean(current?.bot_token_ciphertext),
    inviteUrl: current?.invite_url ?? null,
  };
}

export async function discordPluginRuntimeConfiguration(
  guildId?: string,
): Promise<DiscordPluginRuntimeConfiguration> {
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  const current = await row(resolvedGuildId);
  return {
    guildId: resolvedGuildId,
    enabled: false,
    clientId: current?.client_id ?? null,
    clientSecretConfigured: Boolean(current?.client_secret_ciphertext),
    clientSecret: current?.client_secret_ciphertext ? decryptSecret(current.client_secret_ciphertext) : null,
    discordGuildId: current?.discord_guild_id ?? null,
    botTokenConfigured: Boolean(current?.bot_token_ciphertext),
    botToken: current?.bot_token_ciphertext ? decryptSecret(current.bot_token_ciphertext) : null,
    inviteUrl: current?.invite_url ?? null,
  };
}

export async function updateDiscordPluginConfiguration(
  input: UpdateDiscordPluginConfigurationInput,
  guildId?: string,
): Promise<DiscordPluginConfiguration> {
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  const existing = await row(resolvedGuildId);
  const clientSecretCiphertext = input.clientSecret === undefined
    ? existing?.client_secret_ciphertext ?? null
    : input.clientSecret === null || !input.clientSecret.trim()
      ? null
      : encryptSecret(input.clientSecret.trim());
  const botTokenCiphertext = input.botToken === undefined
    ? existing?.bot_token_ciphertext ?? null
    : input.botToken === null || !input.botToken.trim()
      ? null
      : encryptSecret(input.botToken.trim());

  await pool.query(
    `INSERT INTO discord_module_settings (
       guild_id, enabled, client_id, client_secret_ciphertext, discord_guild_id, bot_token_ciphertext, invite_url
     ) VALUES ($1,false,$2,$3,$4,$5,$6)
     ON CONFLICT (guild_id) DO UPDATE SET
       client_id = EXCLUDED.client_id,
       client_secret_ciphertext = EXCLUDED.client_secret_ciphertext,
       discord_guild_id = EXCLUDED.discord_guild_id,
       bot_token_ciphertext = EXCLUDED.bot_token_ciphertext,
       invite_url = EXCLUDED.invite_url,
       updated_at = now()`,
    [
      resolvedGuildId,
      optionalText(input.clientId),
      clientSecretCiphertext,
      optionalText(input.discordGuildId),
      botTokenCiphertext,
      optionalHttpUrl(input.inviteUrl),
    ],
  );

  return discordPluginConfiguration(resolvedGuildId);
}

export async function discordOAuthRedirectUri(): Promise<string> {
  return installationAbsoluteUrl("/auth/discord/callback");
}
