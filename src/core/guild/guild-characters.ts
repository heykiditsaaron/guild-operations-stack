import { requireOperationalInstallationGuildBinding } from "../installation/guild-binding.js";
import { pool } from "../../db.js";

export type GuildCharacter = {
  guildId: string;
  characterId: string;
  realmId: string;
  name: string;
  realmName: string | null;
  rankIndex: number;
  level: number | null;
  className: string | null;
  raceName: string | null;
  activeSpecName: string | null;
  avatarUrl: string | null;
  insetUrl: string | null;
  mainUrl: string | null;
};

export async function guildCharactersForGuildie(guildieId: string): Promise<GuildCharacter[]> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  const result = await pool.query<{
    guild_id: string; character_id: string; realm_id: string; character_name: string; realm_name: string | null;
    rank_index: number; level: number | null; class_name: string | null; race_name: string | null;
    active_spec_name: string | null; avatar_url: string | null; inset_url: string | null; main_url: string | null;
  }>(
    `SELECT grm.guild_id, grm.character_id, grm.realm_id,
       COALESCE(wcp.name, grm.character_name) AS character_name,
       COALESCE(wcp.realm_name, grm.realm_name) AS realm_name,
       grm.rank_index, wcp.level, wcp.class_name, wcp.race_name, wcp.active_spec_name,
       wcp.avatar_url, wcp.inset_url, wcp.main_url
     FROM characters c
     JOIN guild_roster_memberships grm
       ON grm.region = c.region AND grm.realm_id = c.realm_id AND grm.character_id = c.character_id AND grm.currently_present = true
     LEFT JOIN wow_character_profiles wcp
       ON wcp.region = grm.region AND wcp.realm_id = grm.realm_id AND wcp.character_id = grm.character_id
     WHERE c.identity_id = $1 AND c.currently_controlled = true AND grm.guild_id = $2
     ORDER BY grm.rank_index, grm.character_name`,
    [guildieId, guildId],
  );

  return result.rows.map((row) => ({
    guildId: row.guild_id, characterId: row.character_id, realmId: row.realm_id,
    name: row.character_name, realmName: row.realm_name, rankIndex: row.rank_index,
    level: row.level, className: row.class_name, raceName: row.race_name,
    activeSpecName: row.active_spec_name, avatarUrl: row.avatar_url, insetUrl: row.inset_url, mainUrl: row.main_url,
  }));
}
