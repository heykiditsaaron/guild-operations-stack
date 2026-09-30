import { requireOperationalInstallationGuildBinding } from "../installation/guild-binding.js";
import { pool } from "../../db.js";

export type ControlledGuildMemberCharacter = {
  characterRecordId: string;
  identityId: string;
  guildId: string;
  rankIndex: number;
};

export async function controlledGuildMemberCharacters(
  identityId: string,
  guildId?: string,
): Promise<ControlledGuildMemberCharacter[]> {
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  const result = await pool.query<{
    character_record_id: string;
    identity_id: string;
    guild_id: string;
    rank_index: number;
  }>(
    `SELECT c.character_record_id, c.identity_id, grm.guild_id, grm.rank_index
       FROM characters c
       JOIN guild_roster_memberships grm
         ON grm.region = c.region
        AND grm.realm_id = c.realm_id
        AND grm.character_id = c.character_id
        AND grm.currently_present = true
      WHERE c.identity_id = $1
        AND c.currently_controlled = true
        AND grm.guild_id = $2
      ORDER BY grm.rank_index, c.character_record_id`,
    [identityId, resolvedGuildId],
  );

  return result.rows.map((row) => ({
    characterRecordId: row.character_record_id,
    identityId: row.identity_id,
    guildId: row.guild_id,
    rankIndex: row.rank_index,
  }));
}
