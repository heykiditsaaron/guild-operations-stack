import { requireOperationalInstallationGuildBinding } from "../installation/guild-binding.js";
import { pool } from "../../db.js";

export type GuildRankDefinition = {
  guildId: string;
  rankIndex: number;
  displayName: string;
};
export async function guildRankDefinitions(
  guildId?: string,
): Promise<GuildRankDefinition[]> {
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  const result = await pool.query<{
    guild_id: string;
    rank_index: number;
    display_name: string | null;
  }>(
    `SELECT guild_id, rank_index, display_name
       FROM guild_rank_definitions
      WHERE guild_id = $1
        AND active = true
      ORDER BY rank_index`,
    [resolvedGuildId],
  );

  return result.rows.map((row) => ({
    guildId: row.guild_id,
    rankIndex: row.rank_index,
    displayName: row.display_name ?? `Rank ${row.rank_index}`,
  }));
}

/**
 * Rank labels are Guild Operations presentation metadata, never Blizzard rank authority.
 * The numeric rank coordinate and its membership remain unchanged.
 */
export async function setGuildRankDisplayName(
  rankIndex: number,
  displayName: string,
  guildId?: string,
): Promise<GuildRankDefinition> {
  if (!Number.isSafeInteger(rankIndex) || rankIndex < 0 || rankIndex > 9) {
    throw new Error("invalid_guild_rank");
  }
  const normalized = displayName.trim();
  if (!normalized || normalized.length > 80 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error("invalid_guild_rank_display_name");
  }
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  const result = await pool.query<{ guild_id: string; rank_index: number; display_name: string }>(
    `UPDATE guild_rank_definitions
        SET display_name = $3, updated_at = now()
      WHERE guild_id = $1 AND rank_index = $2 AND active = true
      RETURNING guild_id, rank_index, display_name`,
    [resolvedGuildId, rankIndex, normalized],
  );
  const rank = result.rows[0];
  if (!rank) throw new Error("unknown_guild_rank");
  return { guildId: rank.guild_id, rankIndex: rank.rank_index, displayName: rank.display_name };
}
