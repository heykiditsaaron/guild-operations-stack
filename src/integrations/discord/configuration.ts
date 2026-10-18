import { pool } from "../../db.js";
import { decryptApplicationSecret, encryptApplicationSecret } from "../../core/encrypted-secret.js";

export type DiscordIntegrationConfiguration = {
  enabled: boolean;
  applicationId: string;
  applicationName: string | null;
  applicationVerifiedAt: Date | null;
  interactionPublicKey: string | null;
  botUserId: string | null;
  botUsername: string | null;
  clientSecret: string;
  botToken: string;
  discordGuildId: string | null;
  articleChannelId: string | null;
  raidChannelId: string | null;
};

export async function discordIntegrationConfiguration(): Promise<DiscordIntegrationConfiguration | null> {
  const result = await pool.query<{
    enabled: boolean;
    application_id: string;
    application_name: string | null;
    application_verified_at: Date | null;
    interaction_public_key: string | null;
    bot_user_id: string | null;
    bot_username: string | null;
    client_secret_ciphertext: string;
    bot_token_ciphertext: string;
    discord_guild_id: string | null;
    article_channel_id: string | null;
    raid_channel_id: string | null;
  }>(`SELECT enabled, application_id, application_name, application_verified_at, interaction_public_key, bot_user_id, bot_username, client_secret_ciphertext, bot_token_ciphertext, discord_guild_id, article_channel_id, raid_channel_id
      FROM discord_integration_configuration
      WHERE singleton = true`);
  const row = result.rows[0];
  if (!row) return null;
  return {
    enabled: row.enabled,
    applicationId: row.application_id,
    applicationName: row.application_name,
    applicationVerifiedAt: row.application_verified_at,
    interactionPublicKey: row.interaction_public_key,
    botUserId: row.bot_user_id,
    botUsername: row.bot_username,
    clientSecret: decryptApplicationSecret(row.client_secret_ciphertext, "Discord client secret"),
    botToken: decryptApplicationSecret(row.bot_token_ciphertext, "Discord bot token"),
    discordGuildId: row.discord_guild_id,
    articleChannelId: row.article_channel_id,
    raidChannelId: row.raid_channel_id,
  };
}

export async function discordEncryptedSecretsExist(): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM discord_integration_configuration WHERE singleton = true) AS exists",
  );
  return result.rows[0]?.exists ?? false;
}

export async function storeDiscordIntegrationConfiguration(input: {
  enabled?: boolean;
  applicationId: string;
  clientSecret: string;
  botToken: string;
  discordGuildId?: string | null;
}): Promise<void> {
  const applicationId = input.applicationId.trim();
  const clientSecret = input.clientSecret.trim();
  const botToken = input.botToken.trim();
  if (!applicationId || !clientSecret || !botToken) throw new Error("invalid_discord_configuration");
  const discordGuildId = input.discordGuildId?.trim() || null;
  await pool.query(
    `INSERT INTO discord_integration_configuration (
       singleton, enabled, application_id, client_secret_ciphertext, bot_token_ciphertext, discord_guild_id
     ) VALUES (true, $1, $2, $3, $4, $5)
     ON CONFLICT (singleton) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       application_id = EXCLUDED.application_id,
       application_name = NULL,
       application_verified_at = NULL,
       interaction_public_key = NULL,
       bot_user_id = NULL,
       bot_username = NULL,
       client_secret_ciphertext = EXCLUDED.client_secret_ciphertext,
       bot_token_ciphertext = EXCLUDED.bot_token_ciphertext,
       discord_guild_id = EXCLUDED.discord_guild_id,
       updated_at = now()`,
    [
      input.enabled ?? false,
      applicationId,
      encryptApplicationSecret(clientSecret),
      encryptApplicationSecret(botToken),
      discordGuildId,
    ],
  );
}

export async function markDiscordApplicationEstablished(applicationName: string, botUserId: string | null, botUsername: string | null, interactionPublicKey: string): Promise<void> {
  if (!/^[0-9a-f]{64}$/i.test(interactionPublicKey)) throw new Error("invalid_discord_interaction_public_key");
  await pool.query("UPDATE discord_integration_configuration SET application_name = $1, application_verified_at = now(), bot_user_id = $2, bot_username = $3, interaction_public_key = $4, updated_at = now() WHERE singleton = true", [applicationName, botUserId, botUsername, interactionPublicKey]);
}

export async function establishDiscordGuildBinding(discordGuildId: string): Promise<void> {
  const value = discordGuildId.trim();
  if (!value) throw new Error("invalid_discord_guild_id");
  await pool.query(`UPDATE discord_integration_configuration
       SET discord_guild_id = $1, updated_at = now()
     WHERE singleton = true`, [value]);
}

export async function setDiscordIntegrationEnabled(enabled: boolean): Promise<void> {
  await pool.query(
    "UPDATE discord_integration_configuration SET enabled = $1, updated_at = now() WHERE singleton = true",
    [enabled],
  );
}

export async function replaceDiscordApplicationCredentials(input: {
  applicationId: string;
  clientSecret?: string;
  botToken?: string;
}): Promise<void> {
  const existing = await discordIntegrationConfiguration();
  const applicationId = input.applicationId.trim();
  const clientSecret = input.clientSecret?.trim() || existing?.clientSecret || "";
  const botToken = input.botToken?.trim() || existing?.botToken || "";
  if (!applicationId || !clientSecret || !botToken) throw new Error("invalid_discord_configuration");

  const credentialsChanged =
    !existing ||
    applicationId !== existing.applicationId ||
    clientSecret !== existing.clientSecret ||
    botToken !== existing.botToken;

  if (!credentialsChanged) return;

  await pool.query(
    `INSERT INTO discord_integration_configuration (
       singleton, enabled, application_id, client_secret_ciphertext, bot_token_ciphertext, discord_guild_id
     ) VALUES (true, false, $1, $2, $3, NULL)
     ON CONFLICT (singleton) DO UPDATE SET
       application_id = EXCLUDED.application_id,
       application_name = NULL,
       application_verified_at = NULL,
       bot_user_id = NULL,
       bot_username = NULL,
       client_secret_ciphertext = EXCLUDED.client_secret_ciphertext,
       bot_token_ciphertext = EXCLUDED.bot_token_ciphertext,
       discord_guild_id = NULL,
       article_channel_id = NULL,
       raid_channel_id = NULL,
       updated_at = now()`,
    [applicationId, encryptApplicationSecret(clientSecret), encryptApplicationSecret(botToken)],
  );
}

/** The configured destination is optional; an empty selection disables article projection. */
export async function setDiscordArticleChannel(channelId: string | null): Promise<void> {
  if (channelId !== null && !/^\d+$/.test(channelId)) throw new Error("invalid_discord_article_channel");
  await pool.query(
    "UPDATE discord_integration_configuration SET article_channel_id = $1, updated_at = now() WHERE singleton = true",
    [channelId],
  );
}

/** Optional destination for future Raid projections. */
export async function setDiscordRaidChannel(channelId: string | null): Promise<void> {
  if (channelId !== null && !/^\d+$/.test(channelId)) throw new Error("invalid_discord_raid_channel");
  await pool.query(
    "UPDATE discord_integration_configuration SET raid_channel_id = $1, updated_at = now() WHERE singleton = true",
    [channelId],
  );
}
