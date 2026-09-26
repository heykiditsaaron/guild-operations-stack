import type { Region } from "../../config.js";
import { pool } from "../../db.js";
import { requireOperationalInstallationGuildBinding } from "../installation/guild-binding.js";

export type ControlledCharacter = {
  guildieId: string;
  region: Region;
  realmId: string;
  characterId: string;
  name: string;
  realmName: string | null;
  realmSlug: string | null;
  level: number | null;
  className: string | null;
  activeSpecName: string | null;
  avatarUrl: string | null;
};

export async function controlledCharactersForGuildie(guildieId: string): Promise<ControlledCharacter[]> {
  const result = await pool.query<{
    guildie_id: string;
    region: Region;
    realm_id: string;
    character_id: string;
    character_name: string;
    realm_name: string | null;
    realm_slug: string | null;
    level: number | null;
    class_name: string | null;
    active_spec_name: string | null;
    avatar_url: string | null;
  }>(
    `SELECT
       c.guildie_id,
       c.region,
       c.realm_id,
       c.character_id,
       COALESCE(wcp.name, c.name) AS character_name,
       COALESCE(wcp.realm_name, c.realm_name) AS realm_name,
       COALESCE(wcp.realm_slug, c.realm_slug) AS realm_slug,
       COALESCE(wcp.level, c.level) AS level,
       wcp.class_name,
       wcp.active_spec_name,
       wcp.avatar_url
     FROM characters c
     LEFT JOIN wow_character_profiles wcp
       ON wcp.region = c.region
      AND wcp.realm_id = c.realm_id
      AND wcp.character_id = c.character_id
     WHERE c.guildie_id = $1
       AND c.currently_controlled = true
     ORDER BY character_name, realm_name NULLS LAST`,
    [guildieId],
  );

  return result.rows.map((row) => ({
    guildieId: row.guildie_id,
    region: row.region,
    realmId: row.realm_id,
    characterId: row.character_id,
    name: row.character_name,
    realmName: row.realm_name,
    realmSlug: row.realm_slug,
    level: row.level,
    className: row.class_name,
    activeSpecName: row.active_spec_name,
    avatarUrl: row.avatar_url,
  }));
}


export async function controlledGuildCharactersForGuildie(guildieId: string): Promise<ControlledCharacter[]> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  const result = await pool.query<{
    guildie_id: string;
    region: Region;
    realm_id: string;
    character_id: string;
    character_name: string;
    realm_name: string | null;
    realm_slug: string | null;
    level: number | null;
    class_name: string | null;
    active_spec_name: string | null;
    avatar_url: string | null;
  }>(
    `SELECT
       c.guildie_id,
       c.region,
       c.realm_id,
       c.character_id,
       COALESCE(wcp.name, c.name) AS character_name,
       COALESCE(wcp.realm_name, c.realm_name) AS realm_name,
       COALESCE(wcp.realm_slug, c.realm_slug) AS realm_slug,
       COALESCE(wcp.level, c.level) AS level,
       wcp.class_name,
       wcp.active_spec_name,
       wcp.avatar_url
     FROM characters c
     JOIN guild_roster_memberships grm
       ON grm.region = c.region
      AND grm.realm_id = c.realm_id
      AND grm.character_id = c.character_id
      AND grm.currently_present = true
      AND grm.guild_id = $2
     LEFT JOIN wow_character_profiles wcp
       ON wcp.region = c.region
      AND wcp.realm_id = c.realm_id
      AND wcp.character_id = c.character_id
     WHERE c.guildie_id = $1
       AND c.currently_controlled = true
     ORDER BY grm.rank_index, character_name, realm_name NULLS LAST`,
    [guildieId, guildId],
  );

  return result.rows.map((row) => ({
    guildieId: row.guildie_id,
    region: row.region,
    realmId: row.realm_id,
    characterId: row.character_id,
    name: row.character_name,
    realmName: row.realm_name,
    realmSlug: row.realm_slug,
    level: row.level,
    className: row.class_name,
    activeSpecName: row.active_spec_name,
    avatarUrl: row.avatar_url,
  }));
}
