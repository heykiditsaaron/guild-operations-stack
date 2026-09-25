import { requireOperationalInstallationGuildBinding } from "../installation/guild-binding.js";
import { pool } from "../../db.js";
import { hasDevelopmentGuildMasterAuthority } from "./operator-authority.js";

export type GuildCapability = string;

export const GUILD_REFRESH_CAPABILITY = "guild.refresh";
export const GUILD_REFRESH_SCHEDULE_CONFIGURE_CAPABILITY = "guild.refresh.schedule.configure";
export const MODULES_CONFIGURE_CAPABILITY = "modules.configure";
export const THEME_CONFIGURE_CAPABILITY = "theme.configure";
export const GUILD_PRESENTATION_CONFIGURE_CAPABILITY = "guild.presentation.configure";
export const OPERATIONS_INSPECT_CAPABILITY = "operations.inspect";


export type EffectiveGuildAuthority = {
  guildieId: string;
  guildId: string;
  rankIndex: number;
  rankDisplayName: string;
  capabilities: GuildCapability[];
  developmentGuildMasterAuthority: boolean;
};

export async function effectiveGuildAuthority(
  guildieId: string,
  guildId?: string,
): Promise<EffectiveGuildAuthority | null> {
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  const rankResult = await pool.query<{ rank_index: number; display_name: string | null }>(
    `SELECT grm.rank_index, grd.display_name
       FROM characters c
       JOIN guild_roster_memberships grm
         ON grm.region = c.region AND grm.realm_id = c.realm_id AND grm.character_id = c.character_id AND grm.currently_present = true
       LEFT JOIN guild_rank_definitions grd ON grd.guild_id = grm.guild_id AND grd.rank_index = grm.rank_index
      WHERE c.guildie_id = $1 AND c.currently_controlled = true AND grm.guild_id = $2
      ORDER BY grm.rank_index ASC LIMIT 1`,
    [guildieId, resolvedGuildId],
  );
  const rank = rankResult.rows[0];
  if (!rank) return null;
  const capabilityResult = await pool.query<{ capability: string }>(
    `SELECT capability FROM guild_rank_capabilities WHERE guild_id = $1 AND rank_index = $2 ORDER BY capability`,
    [resolvedGuildId, rank.rank_index],
  );
  return { guildieId, guildId: resolvedGuildId, rankIndex: rank.rank_index, rankDisplayName: rank.display_name ?? `Rank ${rank.rank_index}`, capabilities: capabilityResult.rows.map((row) => row.capability), developmentGuildMasterAuthority: hasDevelopmentGuildMasterAuthority(guildieId) };
}

function hasInherentGuildCapability(authority: EffectiveGuildAuthority | null, guildieId: string): boolean {
  return authority !== null
    && (hasDevelopmentGuildMasterAuthority(guildieId) || authority.rankIndex === 0);
}

export async function guildieHasGuildCapability(guildieId: string, capability: GuildCapability, guildId?: string): Promise<boolean> {
  const authority = await effectiveGuildAuthority(guildieId, guildId);
  if (hasInherentGuildCapability(authority, guildieId)) return true;
  return authority?.capabilities.includes(capability) ?? false;
}

export async function guildieHasGuildCapabilityOrOperator(guildieId: string, capability: GuildCapability, guildId?: string): Promise<boolean> {
  return guildieHasGuildCapability(guildieId, capability, guildId);
}

export async function requireGuildCapability(guildieId: string, capability: GuildCapability, guildId?: string): Promise<EffectiveGuildAuthority> {
  const authority = await effectiveGuildAuthority(guildieId, guildId);
  if (hasInherentGuildCapability(authority, guildieId)) {
    if (authority) return authority;
    const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
    throw new GuildCapabilityDeniedError(resolvedGuildId, capability);
  }
  if (!authority || !authority.capabilities.includes(capability)) {
    const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
    throw new GuildCapabilityDeniedError(resolvedGuildId, capability);
  }
  return authority;
}

export async function requireGuildCapabilityOrOperator(guildieId: string, capability: GuildCapability, guildId?: string): Promise<void> {
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
