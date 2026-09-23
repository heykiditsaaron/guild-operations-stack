import type { Region } from "../../config.js";
import { requireOperationalInstallationGuildBinding } from "../installation/guild-binding.js";
import { pool } from "../../db.js";

export type GuildState = {
  guildId: string;
  region: Region;
  realmId: string;
  name: string;
  realmName: string | null;
  realmSlug: string;
  faction: string | null;
};
export async function guildState(guildId?: string): Promise<GuildState | null> {
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  const result = await pool.query<{
    guild_id: string;
    region: Region;
    realm_id: string;
    name: string;
    realm_name: string | null;
    realm_slug: string;
    faction: string | null;
  }>(
    `SELECT guild_id, region, realm_id, name, realm_name, realm_slug, faction
       FROM guilds
      WHERE guild_id = $1`,
    [resolvedGuildId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    guildId: row.guild_id,
    region: row.region,
    realmId: row.realm_id,
    name: row.name,
    realmName: row.realm_name,
    realmSlug: row.realm_slug,
    faction: row.faction,
  };
}
