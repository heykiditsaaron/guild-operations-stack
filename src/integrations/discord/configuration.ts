import { pool } from "../../db.js";
import { decryptApplicationSecret, encryptApplicationSecret } from "../../core/encrypted-secret.js";

export type DiscordIntegrationConfiguration = {
  enabled: boolean;
  applicationId: string;
  publicKey: string | null;
  clientSecret: string;
  botToken: string;
  discordGuildId: string | null;
};

export async function discordIntegrationConfiguration(): Promise<DiscordIntegrationConfiguration | null> {
  const result = await pool.query<{
    enabled: boolean;
    application_id: string;
    public_key: string | null;
    client_secret_ciphertext: string;
    bot_token_ciphertext: string;
    discord_guild_id: string | null;
  }>(`SELECT enabled, application_id, public_key, client_secret_ciphertext, bot_token_ciphertext, discord_guild_id
      FROM discord_integration_configuration
      WHERE singleton = true`);
  const row = result.rows[0];
  if (!row) return null;
  return {
    enabled: row.enabled,
    applicationId: row.application_id,
    publicKey: row.public_key,
    clientSecret: decryptApplicationSecret(row.client_secret_ciphertext, "Discord client secret"),
    botToken: decryptApplicationSecret(row.bot_token_ciphertext, "Discord bot token"),
    discordGuildId: row.discord_guild_id,
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
  publicKey?: string | null;
  clientSecret: string;
  botToken: string;
  discordGuildId?: string | null;
}): Promise<void> {
  const applicationId = input.applicationId.trim();
  const clientSecret = input.clientSecret.trim();
  const botToken = input.botToken.trim();
  if (!applicationId || !clientSecret || !botToken) throw new Error("invalid_discord_configuration");
  const publicKey = input.publicKey?.trim() || null;
  const discordGuildId = input.discordGuildId?.trim() || null;
  await pool.query(
    `INSERT INTO discord_integration_configuration (
       singleton, enabled, application_id, public_key, client_secret_ciphertext, bot_token_ciphertext, discord_guild_id
     ) VALUES (true, $1, $2, $3, $4, $5, $6)
     ON CONFLICT (singleton) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       application_id = EXCLUDED.application_id,
       public_key = EXCLUDED.public_key,
       client_secret_ciphertext = EXCLUDED.client_secret_ciphertext,
       bot_token_ciphertext = EXCLUDED.bot_token_ciphertext,
       discord_guild_id = EXCLUDED.discord_guild_id,
       updated_at = now()`,
    [
      input.enabled ?? false,
      applicationId,
      publicKey,
      encryptApplicationSecret(clientSecret),
      encryptApplicationSecret(botToken),
      discordGuildId,
    ],
  );
}
