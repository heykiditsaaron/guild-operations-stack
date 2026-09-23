import { config, type Region } from "../../config.js";
import { pool } from "../../db.js";

export type CharacterMembershipCoordinate = {
  guildId: string;
  region: Region;
  realmId: string;
  characterId: string;
};

export type CharacterMembership = CharacterMembershipCoordinate & {
  currentlyPresent: true;
  rankIndex: number;
  characterName: string;
  realmName: string | null;
  realmSlug: string | null;
};
export async function characterMembership(
  coordinate: CharacterMembershipCoordinate,
): Promise<CharacterMembership | null> {
  const result = await pool.query<{
    rank_index: number;
    character_name: string;
    realm_name: string | null;
    realm_slug: string | null;
  }>(
    `SELECT rank_index, character_name, realm_name, realm_slug
       FROM guild_roster_memberships
      WHERE guild_id = $1
        AND region = $2
        AND realm_id = $3
        AND character_id = $4
        AND currently_present = true`,
    [coordinate.guildId, coordinate.region, coordinate.realmId, coordinate.characterId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    ...coordinate,
    currentlyPresent: true,
    rankIndex: row.rank_index,
    characterName: row.character_name,
    realmName: row.realm_name,
    realmSlug: row.realm_slug,
  };
}
