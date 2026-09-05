import { config } from "./config.js";
import { pool } from "./db.js";

export type GuildieAttribution = {
  guildieId: string;
  displayName: string;
  recognitionKind: "main_character" | "discord" | "guildie";
  realmName: string | null;
};

export async function guildieAttributionsForGuildies(
  guildieIds: Array<string | null | undefined>,
): Promise<Map<string, GuildieAttribution>> {
  const uniqueGuildieIds = [...new Set(guildieIds.filter((guildieId): guildieId is string => Boolean(guildieId)))];
  if (uniqueGuildieIds.length === 0) return new Map();

  const result = await pool.query<{
    guildie_id: string;
    main_character_name: string | null;
    realm_name: string | null;
    discord_username: string | null;
  }>(
    `SELECT
       g.guildie_id,
       COALESCE(grm.character_name, c.name) AS main_character_name,
       COALESCE(grm.realm_name, c.realm_name) AS realm_name,
       da.username AS discord_username
     FROM guildies g
     LEFT JOIN guildie_main_characters gmc
       ON gmc.guildie_id = g.guildie_id
      AND gmc.guild_id = $2
     LEFT JOIN characters c
       ON c.guildie_id = g.guildie_id
      AND c.region = gmc.region
      AND c.realm_id = gmc.realm_id
      AND c.character_id = gmc.character_id
     LEFT JOIN guild_roster_memberships grm
       ON grm.guild_id = gmc.guild_id
      AND grm.region = gmc.region
      AND grm.realm_id = gmc.realm_id
      AND grm.character_id = gmc.character_id
     LEFT JOIN discord_associations da
       ON da.guildie_id = g.guildie_id
     WHERE g.guildie_id = ANY($1::uuid[])`,
    [uniqueGuildieIds, config.guild.id],
  );

  return new Map(result.rows.map((row) => {
    const recognitionKind = row.main_character_name
      ? "main_character"
      : row.discord_username
        ? "discord"
        : "guildie";
    const displayName = row.main_character_name
      ?? row.discord_username
      ?? `Guildie ${row.guildie_id.slice(0, 8)}`;

    return [row.guildie_id, {
      guildieId: row.guildie_id,
      displayName,
      recognitionKind,
      realmName: row.realm_name,
    } satisfies GuildieAttribution];
  }));
}
