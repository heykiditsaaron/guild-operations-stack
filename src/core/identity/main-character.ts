import { config } from "../../config.js";
import { pool } from "../../db.js";

export type SelectedMainCharacter = {
  guildId: string;
  characterId: string;
  realmId: string;
  name: string;
  realmName: string | null;
  rankIndex: number | null;
  currentlyEligible: boolean;
  avatarUrl: string | null;
};

export async function selectMainCharacter(
  guildieId: string,
  realmId: string,
  characterId: string,
): Promise<SelectedMainCharacter | null> {
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
       grm.guild_id,
       grm.character_id,
       grm.realm_id,
       grm.character_name,
       grm.realm_name,
       grm.rank_index,
       wcp.avatar_url
     FROM characters c
     JOIN guild_roster_memberships grm
       ON grm.region = c.region
      AND grm.realm_id = c.realm_id
      AND grm.character_id = c.character_id
      AND grm.currently_present = true
     LEFT JOIN wow_character_profiles wcp
       ON wcp.region = c.region
      AND wcp.realm_id = c.realm_id
      AND wcp.character_id = c.character_id
     WHERE c.guildie_id = $1
       AND c.currently_controlled = true
       AND grm.guild_id = $2
       AND c.realm_id = $3
       AND c.character_id = $4`,
    [guildieId, config.guild.id, realmId, characterId],
  );

  if (!result.rowCount) return null;
  const character = result.rows[0];

  const existing = await pool.query<{ realm_id: string; character_id: string }>(
    `SELECT realm_id, character_id
       FROM guildie_main_characters
      WHERE guildie_id = $1
        AND guild_id = $2`,
    [guildieId, config.guild.id],
  );
  const previous = existing.rows[0];
  const changed = !previous || previous.realm_id !== realmId || previous.character_id !== characterId;

  if (changed) {
    await pool.query(
      `INSERT INTO guildie_main_characters (
         guildie_id, guild_id, region, realm_id, character_id
       ) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (guildie_id, guild_id) DO UPDATE SET
         region = EXCLUDED.region,
         realm_id = EXCLUDED.realm_id,
         character_id = EXCLUDED.character_id,
         selected_at = now()`,
      [guildieId, config.guild.id, config.guild.region, realmId, characterId],
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

export async function mainCharacterForGuildie(guildieId: string): Promise<SelectedMainCharacter | null> {
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
       c.name,
       c.realm_name,
       CASE WHEN grm.currently_present IS TRUE THEN grm.rank_index ELSE NULL END AS rank_index,
       (c.currently_controlled IS TRUE AND grm.currently_present IS TRUE) AS currently_eligible,
       wcp.avatar_url
     FROM guildie_main_characters gmc
     JOIN characters c
       ON c.guildie_id = gmc.guildie_id
      AND c.region = gmc.region
      AND c.realm_id = gmc.realm_id
      AND c.character_id = gmc.character_id
     LEFT JOIN guild_roster_memberships grm
       ON grm.guild_id = gmc.guild_id
      AND grm.region = gmc.region
      AND grm.realm_id = gmc.realm_id
      AND grm.character_id = gmc.character_id
     LEFT JOIN wow_character_profiles wcp
       ON wcp.region = gmc.region
      AND wcp.realm_id = gmc.realm_id
      AND wcp.character_id = gmc.character_id
     WHERE gmc.guildie_id = $1
       AND gmc.guild_id = $2`,
    [guildieId, config.guild.id],
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
