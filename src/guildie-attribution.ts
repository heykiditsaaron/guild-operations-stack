import { config } from "./config.js";
import { pool } from "./db.js";

export type GuildieAttribution = {
  subjectId: string;
  displayName: string;
  recognitionKind: "main_character" | "discord" | "subject";
  realmName: string | null;
};

export async function guildieAttributionsForSubjects(
  subjectIds: Array<string | null | undefined>,
): Promise<Map<string, GuildieAttribution>> {
  const uniqueSubjectIds = [...new Set(subjectIds.filter((subjectId): subjectId is string => Boolean(subjectId)))];
  if (uniqueSubjectIds.length === 0) return new Map();

  const result = await pool.query<{
    subject_id: string;
    main_character_name: string | null;
    realm_name: string | null;
    discord_username: string | null;
  }>(
    `SELECT
       gs.subject_id,
       COALESCE(grm.character_name, c.name) AS main_character_name,
       COALESCE(grm.realm_name, c.realm_name) AS realm_name,
       da.username AS discord_username
     FROM guild_subjects gs
     LEFT JOIN subject_main_characters smc
       ON smc.subject_id = gs.subject_id
      AND smc.guild_id = $2
     LEFT JOIN characters c
       ON c.subject_id = gs.subject_id
      AND c.region = smc.region
      AND c.realm_id = smc.realm_id
      AND c.character_id = smc.character_id
     LEFT JOIN guild_roster_memberships grm
       ON grm.guild_id = smc.guild_id
      AND grm.region = smc.region
      AND grm.realm_id = smc.realm_id
      AND grm.character_id = smc.character_id
     LEFT JOIN discord_associations da
       ON da.subject_id = gs.subject_id
     WHERE gs.subject_id = ANY($1::uuid[])`,
    [uniqueSubjectIds, config.guild.id],
  );

  return new Map(result.rows.map((row) => {
    const recognitionKind = row.main_character_name
      ? "main_character"
      : row.discord_username
        ? "discord"
        : "subject";
    const displayName = row.main_character_name
      ?? row.discord_username
      ?? `Guildie ${row.subject_id.slice(0, 8)}`;

    return [row.subject_id, {
      subjectId: row.subject_id,
      displayName,
      recognitionKind,
      realmName: row.realm_name,
    } satisfies GuildieAttribution];
  }));
}
