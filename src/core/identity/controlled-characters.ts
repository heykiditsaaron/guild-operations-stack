import type { Region } from "../../config.js";
import { pool } from "../../db.js";

export type ControlledCharacter = {
  characterRecordId: string;
  identityId: string;
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

export async function controlledCharacterRecordIdsForIdentity(identityId: string): Promise<string[]> {
  const result = await pool.query<{ character_record_id: string }>(
    `SELECT character_record_id
       FROM controlled_character_roster
      WHERE identity_id = $1
        AND currently_controlled = true
      ORDER BY character_record_id`,
    [identityId],
  );
  return result.rows.map((row) => row.character_record_id);
}

export async function controlledCharactersForIdentity(identityId: string): Promise<ControlledCharacter[]> {
  const result = await pool.query<{
    character_record_id: string;
    identity_id: string;
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
       c.character_record_id,
       ccr.identity_id,
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
     FROM controlled_character_roster ccr
     JOIN character_roster c ON c.character_record_id = ccr.character_record_id
     LEFT JOIN wow_character_profiles wcp
       ON wcp.region = c.region
      AND wcp.realm_id = c.realm_id
      AND wcp.character_id = c.character_id
     WHERE ccr.identity_id = $1
       AND ccr.currently_controlled = true
     ORDER BY character_name, realm_name NULLS LAST`,
    [identityId],
  );

  return result.rows.map((row) => ({
    characterRecordId: row.character_record_id,
    identityId: row.identity_id,
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


export async function characterByRecordId(characterRecordId: string): Promise<ControlledCharacter | null> {
  const result = await pool.query<{
    character_record_id: string;
    identity_id: string;
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
       c.character_record_id,
       ccr.identity_id,
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
     FROM character_roster c
     JOIN controlled_character_roster ccr
       ON ccr.character_record_id = c.character_record_id
      AND ccr.currently_controlled = true
     LEFT JOIN wow_character_profiles wcp
       ON wcp.region = c.region
      AND wcp.realm_id = c.realm_id
      AND wcp.character_id = c.character_id
     WHERE c.character_record_id = $1`,
    [characterRecordId],
  );
  const row = result.rows[0];
  return row ? {
    characterRecordId: row.character_record_id,
    identityId: row.identity_id,
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
  } : null;
}
