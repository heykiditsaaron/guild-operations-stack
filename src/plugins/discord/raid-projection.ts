import { config } from "../../config.js";
import { pool } from "../../db.js";

export type DiscordRaidProjectionConfiguration = {
  guildId: string;
  channelId: string | null;
};

export type DiscordRaidProjectionCoordinate = {
  raidId: string;
  guildId: string;
  channelId: string;
  messageId: string;
};

export async function discordRaidProjectionConfiguration(
  guildId: string = config.guild.id,
): Promise<DiscordRaidProjectionConfiguration> {
  const result = await pool.query<{ channel_id: string | null }>(
    "SELECT channel_id FROM discord_raid_projection_settings WHERE guild_id = $1",
    [guildId],
  );
  return { guildId, channelId: result.rows[0]?.channel_id ?? null };
}

export async function configureDiscordRaidProjection(
  channelId: string | null,
  guildId: string = config.guild.id,
): Promise<DiscordRaidProjectionConfiguration> {
  const normalized = channelId?.trim() || null;
  await pool.query(
    `INSERT INTO discord_raid_projection_settings (guild_id, channel_id)
     VALUES ($1, $2)
     ON CONFLICT (guild_id) DO UPDATE SET
       channel_id = EXCLUDED.channel_id,
       updated_at = now()`,
    [guildId, normalized],
  );
  return { guildId, channelId: normalized };
}

export async function discordRaidProjectionCoordinate(
  raidId: string,
): Promise<DiscordRaidProjectionCoordinate | null> {
  const result = await pool.query<{
    raid_id: string;
    guild_id: string;
    discord_channel_id: string;
    discord_message_id: string;
  }>(
    `SELECT raid_id, guild_id, discord_channel_id, discord_message_id
       FROM discord_raid_projections
      WHERE raid_id = $1`,
    [raidId],
  );
  const row = result.rows[0];
  return row ? {
    raidId: row.raid_id,
    guildId: row.guild_id,
    channelId: row.discord_channel_id,
    messageId: row.discord_message_id,
  } : null;
}

export async function recordDiscordRaidProjection(
  coordinate: DiscordRaidProjectionCoordinate,
): Promise<void> {
  await pool.query(
    `INSERT INTO discord_raid_projections (
       raid_id, guild_id, discord_channel_id, discord_message_id
     ) VALUES ($1, $2, $3, $4)
     ON CONFLICT (raid_id) DO UPDATE SET
       discord_channel_id = EXCLUDED.discord_channel_id,
       discord_message_id = EXCLUDED.discord_message_id,
       updated_at = now()`,
    [coordinate.raidId, coordinate.guildId, coordinate.channelId, coordinate.messageId],
  );
}
