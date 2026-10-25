import { pool } from "../../db.js";
import { hostDiscordCredentials } from "./host-credentials.js";

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
  raffleChannelId: string | null;
};

export async function discordIntegrationConfiguration(): Promise<DiscordIntegrationConfiguration | null> {
  const hostCredentials = hostDiscordCredentials();
  const result = await pool.query<{
    enabled: boolean;
    application_id: string;
    application_name: string | null;
    application_verified_at: Date | null;
    interaction_public_key: string | null;
    bot_user_id: string | null;
    bot_username: string | null;
    discord_guild_id: string | null;
    article_channel_id: string | null;
    raid_channel_id: string | null;
    raffle_channel_id: string | null;
  }>(`SELECT enabled, application_id, application_name, application_verified_at, interaction_public_key, bot_user_id, bot_username, discord_guild_id, article_channel_id, raid_channel_id, raffle_channel_id
      FROM discord_integration_configuration
      WHERE singleton = true`);
  const row = result.rows[0];
  if (!hostCredentials) return null;
  if (!row && hostCredentials) {
    return {
      enabled: false,
      applicationId: hostCredentials.applicationId,
      applicationName: null,
      applicationVerifiedAt: null,
      interactionPublicKey: null,
      botUserId: null,
      botUsername: null,
      clientSecret: hostCredentials.clientSecret,
      botToken: hostCredentials.botToken,
      discordGuildId: null,
      articleChannelId: null,
      raidChannelId: null,
      raffleChannelId: null,
    };
  }
  if (!row) return null;
  const credentialsMatch = hostCredentials.applicationId === row.application_id;
  return {
    enabled: row.enabled && credentialsMatch,
    applicationId: hostCredentials.applicationId,
    applicationName: credentialsMatch ? row.application_name : null,
    applicationVerifiedAt: credentialsMatch ? row.application_verified_at : null,
    interactionPublicKey: credentialsMatch ? row.interaction_public_key : null,
    botUserId: credentialsMatch ? row.bot_user_id : null,
    botUsername: credentialsMatch ? row.bot_username : null,
    clientSecret: hostCredentials.clientSecret,
    botToken: hostCredentials.botToken,
    discordGuildId: credentialsMatch ? row.discord_guild_id : null,
    articleChannelId: credentialsMatch ? row.article_channel_id : null,
    raidChannelId: credentialsMatch ? row.raid_channel_id : null,
    raffleChannelId: credentialsMatch ? row.raffle_channel_id : null,
  };
}

/** Establish the guild-owned Discord record from verified host application credentials.
 * Existing guild settings are preserved when the application identity is unchanged.
 */
export async function establishHostDiscordApplication(input: {
  applicationName: string;
  botUserId: string | null;
  botUsername: string | null;
  interactionPublicKey: string;
}): Promise<void> {
  const host = hostDiscordCredentials();
  if (!host) throw new Error("discord_host_configuration_required");
  if (!/^[0-9a-f]{64}$/i.test(input.interactionPublicKey)) throw new Error("invalid_discord_interaction_public_key");
  await pool.query(
    `INSERT INTO discord_integration_configuration (
       singleton, enabled, application_id,
       application_name, application_verified_at, bot_user_id, bot_username, interaction_public_key
     ) VALUES (true, false, $1, $2, now(), $3, $4, $5)
     ON CONFLICT (singleton) DO UPDATE SET
       application_name = EXCLUDED.application_name,
       application_verified_at = EXCLUDED.application_verified_at,
       bot_user_id = EXCLUDED.bot_user_id,
       bot_username = EXCLUDED.bot_username,
       interaction_public_key = EXCLUDED.interaction_public_key,
       updated_at = now()
     WHERE discord_integration_configuration.application_id = EXCLUDED.application_id`,
    [host.applicationId, input.applicationName, input.botUserId, input.botUsername, input.interactionPublicKey],
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

/** Optional destination for Raffle announcements and claim ledger threads. */
export async function setDiscordRaffleChannel(channelId: string | null): Promise<void> {
  if (channelId !== null && !/^[0-9]+$/.test(channelId)) throw new Error("invalid_discord_raffle_channel");
  await pool.query(
    "UPDATE discord_integration_configuration SET raffle_channel_id = $1, updated_at = now() WHERE singleton = true",
    [channelId],
  );
}
