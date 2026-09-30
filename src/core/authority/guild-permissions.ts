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
  identityId: string;
  guildId: string;
  rankIndex: number;
  rankDisplayName: string;
  capabilities: GuildCapability[];
  developmentGuildMasterAuthority: boolean;
};

export async function effectiveGuildAuthority(
  identityId: string,
  guildId?: string,
): Promise<EffectiveGuildAuthority | null> {
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  const rankResult = await pool.query<{ rank_index: number; display_name: string | null }>(
    `SELECT grm.rank_index, grd.display_name
       FROM characters c
       JOIN guild_roster_memberships grm
         ON grm.region = c.region AND grm.realm_id = c.realm_id AND grm.character_id = c.character_id AND grm.currently_present = true
       LEFT JOIN guild_rank_definitions grd ON grd.guild_id = grm.guild_id AND grd.rank_index = grm.rank_index
      WHERE c.identity_id = $1 AND c.currently_controlled = true AND grm.guild_id = $2
      ORDER BY grm.rank_index ASC LIMIT 1`,
    [identityId, resolvedGuildId],
  );
  const rank = rankResult.rows[0];
  if (!rank) return null;
  const capabilityResult = await pool.query<{ capability: string }>(
    `SELECT capability FROM guild_rank_capabilities WHERE guild_id = $1 AND rank_index = $2 ORDER BY capability`,
    [resolvedGuildId, rank.rank_index],
  );
  return { identityId, guildId: resolvedGuildId, rankIndex: rank.rank_index, rankDisplayName: rank.display_name ?? `Rank ${rank.rank_index}`, capabilities: capabilityResult.rows.map((row) => row.capability), developmentGuildMasterAuthority: hasDevelopmentGuildMasterAuthority(identityId) };
}

function hasInherentGuildCapability(authority: EffectiveGuildAuthority | null, identityId: string): boolean {
  return authority !== null
    && (hasDevelopmentGuildMasterAuthority(identityId) || authority.rankIndex === 0);
}

export async function identityHasGuildCapability(identityId: string, capability: GuildCapability, guildId?: string): Promise<boolean> {
  const authority = await effectiveGuildAuthority(identityId, guildId);
  if (hasInherentGuildCapability(authority, identityId)) return true;
  return authority?.capabilities.includes(capability) ?? false;
}

export async function identityHasGuildCapabilityOrOperator(identityId: string, capability: GuildCapability, guildId?: string): Promise<boolean> {
  return identityHasGuildCapability(identityId, capability, guildId);
}

export async function requireGuildCapability(identityId: string, capability: GuildCapability, guildId?: string): Promise<EffectiveGuildAuthority> {
  const authority = await effectiveGuildAuthority(identityId, guildId);
  if (hasInherentGuildCapability(authority, identityId)) {
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

export async function requireGuildCapabilityOrOperator(identityId: string, capability: GuildCapability, guildId?: string): Promise<void> {
  await requireGuildCapability(identityId, capability, guildId);
}

export class GuildCapabilityDeniedError extends Error {
  readonly guildId: string;
  readonly capability: GuildCapability;
  constructor(guildId: string, capability: GuildCapability) {
    super(`Identity lacks required guild capability: ${capability}`);
    this.name = "GuildCapabilityDeniedError";
    this.guildId = guildId;
    this.capability = capability;
  }
}
