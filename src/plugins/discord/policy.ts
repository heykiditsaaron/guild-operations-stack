import { config } from "../../config.js";
import { pool, withTransaction } from "../../db.js";

export type DiscordRankRoleMapping = {
  rankIndex: number;
  discordRoleId: string;
};

export type GuildDiscordProjectionSettings = {
  guildId: string;
  enabled: boolean;
  linkedMappingEnabled: boolean;
  rankMappingEnabled: boolean;
  linkedRoleId: string | null;
  rankRoles: DiscordRankRoleMapping[];
};

export async function guildDiscordProjectionSettings(
  guildId: string = config.guild.id,
  includeInactiveMappings = false,
): Promise<GuildDiscordProjectionSettings> {
  const [settingsResult, rankRolesResult] = await Promise.all([
    pool.query<{
      linked_enabled: boolean;
      rank_enabled: boolean;
      linked_role_id: string | null;
    }>(
      `SELECT linked_enabled, rank_enabled, linked_role_id
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

  const linkedMappingEnabled = settingsResult.rows[0]?.linked_enabled ?? false;
  const rankMappingEnabled = settingsResult.rows[0]?.rank_enabled ?? false;
  const configuredLinkedRoleId = settingsResult.rows[0]?.linked_role_id ?? null;
  const configuredRankRoles = rankRolesResult.rows.map((row) => ({
    rankIndex: row.rank_index,
    discordRoleId: row.discord_role_id,
  }));

  return {
    guildId,
    enabled: linkedMappingEnabled || rankMappingEnabled,
    linkedMappingEnabled,
    rankMappingEnabled,
    linkedRoleId: includeInactiveMappings || linkedMappingEnabled ? configuredLinkedRoleId : null,
    rankRoles: includeInactiveMappings || rankMappingEnabled ? configuredRankRoles : [],
  };
}

export async function replaceGuildDiscordProjectionSettings(input: {
  guildId?: string;
  linkedMappingEnabled: boolean;
  rankMappingEnabled: boolean;
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
      `INSERT INTO guild_discord_projection_settings (guild_id, linked_enabled, rank_enabled, linked_role_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (guild_id) DO UPDATE SET
         linked_enabled = EXCLUDED.linked_enabled,
         rank_enabled = EXCLUDED.rank_enabled,
         linked_role_id = EXCLUDED.linked_role_id,
         updated_at = now()`,
      [guildId, input.linkedMappingEnabled, input.rankMappingEnabled, linkedRoleId],
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

  return guildDiscordProjectionSettings(guildId, true);
}
