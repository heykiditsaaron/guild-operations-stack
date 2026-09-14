import { config } from "./config.js";
import { pool } from "./db.js";
import { isConfiguredOperator } from "./operator-authority.js";

export type GuildCapability = string;

export const GUILD_REFRESH_CAPABILITY = "guild.refresh";
export const GUILD_REFRESH_SCHEDULE_CONFIGURE_CAPABILITY = "guild.refresh.schedule.configure";
export const MODULES_CONFIGURE_CAPABILITY = "modules.configure";
export const OPERATIONS_INSPECT_CAPABILITY = "operations.inspect";
export const RAID_CREATE_CAPABILITY = "raid.create";
export const RAID_MANAGE_CAPABILITY = "raid.manage";
export const RAID_PERMISSIONS_CAPABILITY = "raid.permissions";

export type EffectiveGuildAuthority = {
  guildieId: string;
  guildId: string;
  rankIndex: number;
  rankDisplayName: string;
  capabilities: GuildCapability[];
  operator: boolean;
};

export async function effectiveGuildAuthority(
  guildieId: string,
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
     WHERE c.guildie_id = $1
       AND c.currently_controlled = true
       AND grm.guild_id = $2
     ORDER BY grm.rank_index ASC
     LIMIT 1`,
    [guildieId, guildId],
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
    guildieId,
    guildId,
    rankIndex: rank.rank_index,
    rankDisplayName: rank.display_name ?? `Rank ${rank.rank_index}`,
    capabilities: capabilityResult.rows.map((row) => row.capability),
    operator: isConfiguredOperator(guildieId),
  };
}

export async function guildieHasGuildCapability(
  guildieId: string,
  capability: GuildCapability,
  guildId: string = config.guild.id,
): Promise<boolean> {
  const authority = await effectiveGuildAuthority(guildieId, guildId);
  return authority?.capabilities.includes(capability) ?? false;
}

export async function guildieHasGuildCapabilityOrOperator(
  guildieId: string,
  capability: GuildCapability,
  guildId: string = config.guild.id,
): Promise<boolean> {
  if (isConfiguredOperator(guildieId)) return true;
  return guildieHasGuildCapability(guildieId, capability, guildId);
}

export async function requireGuildCapability(
  guildieId: string,
  capability: GuildCapability,
  guildId: string = config.guild.id,
): Promise<EffectiveGuildAuthority> {
  const authority = await effectiveGuildAuthority(guildieId, guildId);

  if (!authority || !authority.capabilities.includes(capability)) {
    throw new GuildCapabilityDeniedError(guildId, capability);
  }

  return authority;
}

export async function requireGuildCapabilityOrOperator(
  guildieId: string,
  capability: GuildCapability,
  guildId: string = config.guild.id,
): Promise<void> {
  if (isConfiguredOperator(guildieId)) return;
  await requireGuildCapability(guildieId, capability, guildId);
}

export class GuildCapabilityDeniedError extends Error {
  readonly guildId: string;
  readonly capability: GuildCapability;

  constructor(guildId: string, capability: GuildCapability) {
    super(`Guildie lacks required guild capability: ${capability}`);
    this.name = "GuildCapabilityDeniedError";
    this.guildId = guildId;
    this.capability = capability;
  }
}
