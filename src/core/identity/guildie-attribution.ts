import { requireOperationalInstallationGuildBinding } from "../installation/guild-binding.js";
import { pool } from "../../db.js";

export type GuildieAttribution = {
  guildieId: string;
  displayName: string;
  recognitionKind: "main_character" | "guildie";
  realmName: string | null;
};

export async function guildieAttributionsForGuildies(
  guildieIds: Array<string | null | undefined>,
): Promise<Map<string, GuildieAttribution>> {
  const uniqueGuildieIds = [...new Set(guildieIds.filter((guildieId): guildieId is string => Boolean(guildieId)))];
  if (uniqueGuildieIds.length === 0) return new Map();
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;

  const result = await pool.query<{
    guildie_id: string;
    main_character_name: string | null;
    realm_name: string | null;
  }>(
    `SELECT
       i.identity_id AS guildie_id,
       COALESCE(wcp.name, cr.name) AS main_character_name,
       COALESCE(wcp.realm_name, cr.realm_name) AS realm_name
     FROM identities i
     LEFT JOIN identity_character_representations gmc
       ON gmc.identity_id = i.identity_id
      AND gmc.guild_id = $2
     LEFT JOIN character_roster cr
       ON cr.region = gmc.region
      AND cr.realm_id = gmc.realm_id
      AND cr.character_id = gmc.character_id
     LEFT JOIN controlled_character_roster ccr
       ON ccr.identity_id = i.identity_id
      AND ccr.character_record_id = cr.character_record_id
      AND ccr.currently_controlled = true
     LEFT JOIN guild_roster gr
       ON gr.guild_id = gmc.guild_id
      AND gr.character_record_id = cr.character_record_id
      AND gr.currently_present = true
     LEFT JOIN wow_character_profiles wcp
       ON wcp.region = cr.region
      AND wcp.realm_id = cr.realm_id
      AND wcp.character_id = cr.character_id
     WHERE i.identity_id = ANY($1::uuid[])
       AND (cr.character_record_id IS NULL OR (ccr.character_record_id IS NOT NULL AND gr.character_record_id IS NOT NULL))`,
    [uniqueGuildieIds, guildId],
  );

  return new Map(result.rows.map((row) => {
    const recognitionKind = row.main_character_name ? "main_character" : "guildie";
    const displayName = row.main_character_name ?? `Guildie ${row.guildie_id.slice(0, 8)}`;

    return [row.guildie_id, {
      guildieId: row.guildie_id,
      displayName,
      recognitionKind,
      realmName: row.realm_name,
    } satisfies GuildieAttribution];
  }));
}
