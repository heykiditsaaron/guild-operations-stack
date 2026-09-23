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
