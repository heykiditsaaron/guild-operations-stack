import { config } from "./config.js";
import { pool } from "./db.js";

export type GuildCapability = string;

export const GUILD_REFRESH_CAPABILITY = "guild.refresh";

export type EffectiveGuildAuthority = {
  guildId: string;
  rankIndex: number;
  rankDisplayName: string;
  capabilities: GuildCapability[];
};

export async function effectiveGuildAuthority(
  subjectId: string,
  guildId: string = config.guild.id,
): Promise<EffectiveGuildAuthority | null> {
  const rankResult = await pool.query<{
    rank_index: number;
    display_name: string | null;
  }>(
    `SELECT
       grm.rank_index,
       grd.display_name
     FROM characters c
     JOIN guild_roster_memberships grm
       ON grm.region = c.region
      AND grm.realm_id = c.realm_id
      AND grm.character_id = c.character_id
      AND grm.currently_present = true
     LEFT JOIN guild_rank_definitions grd
       ON grd.guild_id = grm.guild_id
      AND grd.rank_index = grm.rank_index
     WHERE c.subject_id = $1
       AND c.currently_controlled = true
       AND grm.guild_id = $2
     ORDER BY grm.rank_index ASC
     LIMIT 1`,
    [subjectId, guildId],
  );

  const rank = rankResult.rows[0];
  if (!rank) return null;

  const capabilityResult = await pool.query<{ capability: string }>(
    `SELECT capability
       FROM guild_rank_capabilities
      WHERE guild_id = $1
        AND rank_index = $2
      ORDER BY capability`,
    [guildId, rank.rank_index],
  );

  return {
    guildId,
    rankIndex: rank.rank_index,
    rankDisplayName: rank.display_name ?? `Rank ${rank.rank_index}`,
    capabilities: capabilityResult.rows.map((row) => row.capability),
  };
}

export async function subjectHasGuildCapability(
  subjectId: string,
  capability: GuildCapability,
  guildId: string = config.guild.id,
): Promise<boolean> {
  const authority = await effectiveGuildAuthority(subjectId, guildId);
  return authority?.capabilities.includes(capability) ?? false;
}

export async function requireGuildCapability(
  subjectId: string,
  capability: GuildCapability,
  guildId: string = config.guild.id,
): Promise<EffectiveGuildAuthority> {
  const authority = await effectiveGuildAuthority(subjectId, guildId);

  if (!authority || !authority.capabilities.includes(capability)) {
    throw new GuildCapabilityDeniedError(guildId, capability);
  }

  return authority;
}

export class GuildCapabilityDeniedError extends Error {
  readonly guildId: string;
  readonly capability: GuildCapability;

  constructor(guildId: string, capability: GuildCapability) {
    super(`Subject lacks required guild capability: ${capability}`);
    this.name = "GuildCapabilityDeniedError";
    this.guildId = guildId;
    this.capability = capability;
  }
}
