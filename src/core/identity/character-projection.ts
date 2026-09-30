import { pool } from "../../db.js";
import type { Region } from "../../config.js";

export type CharacterProjection = {
  characterRecordId: string;
  region: Region;
  realmId: string;
  characterId: string;
  name: string;
  realmName: string | null;
  realmSlug: string | null;
  level: number | null;
  className: string | null;
  raceName: string | null;
  activeSpecName: string | null;
  avatarUrl: string | null;
  insetUrl: string | null;
  mainUrl: string | null;
};

export async function characterProjections(
  characterRecordIds: string[],
): Promise<CharacterProjection[]> {
  if (characterRecordIds.length === 0) return [];

  const result = await pool.query<{
    character_record_id: string;
    region: Region;
    realm_id: string;
    character_id: string;
    character_name: string;
    realm_name: string | null;
    realm_slug: string | null;
    level: number | null;
    class_name: string | null;
    race_name: string | null;
    active_spec_name: string | null;
    avatar_url: string | null;
    inset_url: string | null;
    main_url: string | null;
  }>(
    `SELECT
       c.character_record_id,
       c.region,
       c.realm_id,
       c.character_id,
       COALESCE(wcp.name, c.name) AS character_name,
       COALESCE(wcp.realm_name, c.realm_name) AS realm_name,
       COALESCE(wcp.realm_slug, c.realm_slug) AS realm_slug,
       COALESCE(wcp.level, c.level) AS level,
       wcp.class_name,
       wcp.race_name,
       wcp.active_spec_name,
       wcp.avatar_url,
       wcp.inset_url,
       wcp.main_url
     FROM character_roster c
     LEFT JOIN wow_character_profiles wcp
       ON wcp.region = c.region
      AND wcp.realm_id = c.realm_id
      AND wcp.character_id = c.character_id
     WHERE c.character_record_id = ANY($1::uuid[])`,
    [characterRecordIds],
  );

  const byRecordId = new Map(result.rows.map((row) => [row.character_record_id, row]));
  return characterRecordIds.flatMap((characterRecordId) => {
    const row = byRecordId.get(characterRecordId);
    return row ? [{
      characterRecordId: row.character_record_id,
      region: row.region,
      realmId: row.realm_id,
      characterId: row.character_id,
      name: row.character_name,
      realmName: row.realm_name,
      realmSlug: row.realm_slug,
      level: row.level,
      className: row.class_name,
      raceName: row.race_name,
      activeSpecName: row.active_spec_name,
      avatarUrl: row.avatar_url,
      insetUrl: row.inset_url,
      mainUrl: row.main_url,
    }] : [];
  });
}
