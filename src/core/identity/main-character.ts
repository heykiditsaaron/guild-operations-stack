import { requireOperationalInstallationGuildBinding } from "../installation/guild-binding.js";
import { pool } from "../../db.js";

export type CharacterRepresentation = {
  guildId: string;
  characterId: string;
  realmId: string;
  name: string;
  realmName: string | null;
  rankIndex: number | null;
  currentlyEligible: boolean;
  avatarUrl: string | null;
};

export async function selectCharacterRepresentation(
  identityId: string,
  realmId: string,
  characterId: string,
): Promise<CharacterRepresentation | null> {
  const binding = await requireOperationalInstallationGuildBinding();
  const guild = await pool.query<{ region: string }>("SELECT region FROM guilds WHERE guild_id = $1", [binding.guildId]);
  const guildRegion = guild.rows[0]?.region;
  if (!guildRegion) throw new Error("Bound guild is not persisted");
  const result = await pool.query<{
    guild_id: string;
    character_id: string;
    realm_id: string;
    character_name: string;
    realm_name: string | null;
    rank_index: number;
    avatar_url: string | null;
  }>(
    `SELECT
       gr.guild_id,
       cr.character_id,
       cr.realm_id,
       cr.name AS character_name,
       cr.realm_name,
       gr.rank_index,
       wcp.avatar_url
     FROM controlled_character_roster ccr
     JOIN character_roster cr ON cr.character_record_id = ccr.character_record_id
     JOIN guild_roster gr
       ON gr.character_record_id = cr.character_record_id
      AND gr.currently_present = true
     LEFT JOIN wow_character_profiles wcp
       ON wcp.region = cr.region
      AND wcp.realm_id = cr.realm_id
      AND wcp.character_id = cr.character_id
     WHERE ccr.identity_id = $1
       AND ccr.currently_controlled = true
       AND gr.guild_id = $2
       AND cr.realm_id = $3
       AND cr.character_id = $4`,
    [identityId, binding.guildId, realmId, characterId],
  );

  if (!result.rowCount) return null;
  const character = result.rows[0];

  const existing = await pool.query<{ realm_id: string; character_id: string }>(
    `SELECT realm_id, character_id
       FROM identity_character_representations
      WHERE identity_id = $1
        AND guild_id = $2`,
    [identityId, binding.guildId],
  );
  const previous = existing.rows[0];
  const changed = !previous || previous.realm_id !== realmId || previous.character_id !== characterId;

  if (changed) {
    await pool.query(
      `INSERT INTO identity_character_representations (
         identity_id, guild_id, region, realm_id, character_id
       ) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (identity_id, guild_id) DO UPDATE SET
         region = EXCLUDED.region,
         realm_id = EXCLUDED.realm_id,
         character_id = EXCLUDED.character_id,
         selected_at = now()`,
      [identityId, binding.guildId, guildRegion, realmId, characterId],
    );
  }

  return {
    guildId: character.guild_id,
    characterId: character.character_id,
    realmId: character.realm_id,
    name: character.character_name,
    realmName: character.realm_name,
    rankIndex: character.rank_index,
    currentlyEligible: true,
    avatarUrl: character.avatar_url,
  };
}

export async function characterRepresentationForIdentity(identityId: string): Promise<CharacterRepresentation | null> {
  const binding = await requireOperationalInstallationGuildBinding();
  const result = await pool.query<{
    guild_id: string;
    character_id: string;
    realm_id: string;
    name: string;
    realm_name: string | null;
    rank_index: number | null;
    currently_eligible: boolean;
    avatar_url: string | null;
  }>(
    `SELECT
       gmc.guild_id,
       gmc.character_id,
       gmc.realm_id,
       cr.name,
       cr.realm_name,
       CASE WHEN gr.currently_present IS TRUE THEN gr.rank_index ELSE NULL END AS rank_index,
       (ccr.currently_controlled IS TRUE AND gr.currently_present IS TRUE) AS currently_eligible,
       wcp.avatar_url
     FROM identity_character_representations gmc
     JOIN character_roster cr
       ON cr.region = gmc.region
      AND cr.realm_id = gmc.realm_id
      AND cr.character_id = gmc.character_id
     LEFT JOIN controlled_character_roster ccr
       ON ccr.identity_id = gmc.identity_id
      AND ccr.character_record_id = cr.character_record_id
     LEFT JOIN guild_roster gr
       ON gr.guild_id = gmc.guild_id
      AND gr.character_record_id = cr.character_record_id
     LEFT JOIN wow_character_profiles wcp
       ON wcp.region = cr.region
      AND wcp.realm_id = cr.realm_id
      AND wcp.character_id = cr.character_id
     WHERE gmc.identity_id = $1
       AND gmc.guild_id = $2`,
    [identityId, binding.guildId],
  );

  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    guildId: row.guild_id,
    characterId: row.character_id,
    realmId: row.realm_id,
    name: row.name,
    realmName: row.realm_name,
    rankIndex: row.rank_index,
    currentlyEligible: row.currently_eligible,
    avatarUrl: row.avatar_url,
  };
}
