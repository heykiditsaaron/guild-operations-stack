import { config } from "../config.js";
import { pool, withTransaction } from "../db.js";

export type DiscordRankRoleMapping = {
  rankIndex: number;
  discordRoleId: string;
};

export type GuildDiscordProjectionSettings = {
  guildId: string;
  enabled: boolean;
  linkedRoleId: string | null;
  rankRoles: DiscordRankRoleMapping[];
};

export async function guildDiscordProjectionSettings(
  guildId: string = config.guild.id,
): Promise<GuildDiscordProjectionSettings> {
  const [settingsResult, rankRolesResult] = await Promise.all([
    pool.query<{ enabled: boolean; linked_role_id: string | null }>(
      `SELECT enabled, linked_role_id
         FROM guild_discord_projection_settings
        WHERE guild_id = $1`,
      [guildId],
    ),
    pool.query<{ rank_index: number; discord_role_id: string }>(
      `SELECT rank_index, discord_role_id
         FROM guild_discord_rank_roles
        WHERE guild_id = $1
        ORDER BY rank_index`,
      [guildId],
    ),
  ]);

  return {
    guildId,
    enabled: settingsResult.rows[0]?.enabled ?? false,
    linkedRoleId: settingsResult.rows[0]?.linked_role_id ?? null,
    rankRoles: rankRolesResult.rows.map((row) => ({
      rankIndex: row.rank_index,
      discordRoleId: row.discord_role_id,
    })),
  };
}

export async function replaceGuildDiscordProjectionSettings(input: {
  guildId?: string;
  enabled: boolean;
  linkedRoleId: string | null;
  rankRoles: DiscordRankRoleMapping[];
}): Promise<GuildDiscordProjectionSettings> {
  const guildId = input.guildId ?? config.guild.id;
  const linkedRoleId = input.linkedRoleId?.trim() || null;
  const normalizedRankRoles = input.rankRoles
    .filter((mapping) => Number.isInteger(mapping.rankIndex) && mapping.rankIndex >= 0 && mapping.discordRoleId.trim())
    .map((mapping) => ({ rankIndex: mapping.rankIndex, discordRoleId: mapping.discordRoleId.trim() }));

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO guild_discord_projection_settings (guild_id, enabled, linked_role_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         linked_role_id = EXCLUDED.linked_role_id,
         updated_at = now()`,
      [guildId, input.enabled, linkedRoleId],
    );

    await client.query("DELETE FROM guild_discord_rank_roles WHERE guild_id = $1", [guildId]);
    for (const mapping of normalizedRankRoles) {
      await client.query(
        `INSERT INTO guild_discord_rank_roles (guild_id, rank_index, discord_role_id)
         VALUES ($1, $2, $3)`,
        [guildId, mapping.rankIndex, mapping.discordRoleId],
      );
    }
  });

  return guildDiscordProjectionSettings(guildId);
}
