import { effectiveGuildAuthority } from "../../core/authority/guild-permissions.js";
import { discordServerMember, discordServerRoles, discordRoleReadiness, discordSetMemberRole } from "./api.js";
import type { DiscordIntegrationConfiguration } from "./configuration.js";
import { discordRankRoleMappings, managedDiscordRankRoleIds } from "./role-mappings.js";

export type DiscordRankReconciliationResult =
  | { status: "unconfigured" | "member_not_in_server" | "unchanged" | "updated"; added: string[]; removed: string[] }
  | { status: "not_ready"; reasons: string[] };

/** Reconcile only Guild Operations-managed rank roles; preserve every unrelated role. */
export async function reconcileDiscordRankRole(input: {
  configuration: DiscordIntegrationConfiguration;
  guildId: string;
  wowIdentityId: string;
  discordUserId: string;
}): Promise<DiscordRankReconciliationResult> {
  const { configuration, guildId, wowIdentityId, discordUserId } = input;
  if (!configuration.enabled || !configuration.discordGuildId || !configuration.botUserId || !configuration.applicationVerifiedAt) {
    return { status: "not_ready", reasons: ["Discord Integration is not enabled and established."] };
  }
  const mappings = await discordRankRoleMappings(guildId);
  const managed = await managedDiscordRankRoleIds(configuration.discordGuildId);
  if (mappings.length === 0 && managed.length === 0) return { status: "unconfigured", added: [], removed: [] };

  const member = await discordServerMember(configuration.botToken, configuration.discordGuildId, discordUserId);
  if (!member) return { status: "member_not_in_server", added: [], removed: [] };
  const bot = await discordServerMember(configuration.botToken, configuration.discordGuildId, configuration.botUserId);
  if (!bot) return { status: "not_ready", reasons: ["Discord bot is not a member of the bound server."] };

  const roles = await discordServerRoles(configuration.botToken, configuration.discordGuildId);
  const currentManaged = managed.filter((id) => member.roles.includes(id));
  const readiness = discordRoleReadiness({
    roles, botRoleIds: bot.roles, botUserId: configuration.botUserId,
    guildId: configuration.discordGuildId,
    mappedRoleIds: [...new Set([...mappings.map((mapping) => mapping.discordRoleId), ...currentManaged])],
  });
  if (!readiness.ready) return { status: "not_ready", reasons: readiness.reasons };

  // Identity is the subject; Core derives current authority from Blizzard-backed character facts.
  const rank = (await effectiveGuildAuthority(wowIdentityId, guildId))?.rankIndex;
  const desired = mappings.find((mapping) => mapping.rankIndex === rank)?.discordRoleId ?? null;
  const removed: string[] = [];
  const added: string[] = [];
  // Remove obsolete managed roles first, but never touch any unrelated Discord role.
  for (const roleId of currentManaged) {
    if (roleId === desired) continue;
    await discordSetMemberRole({
      botToken: configuration.botToken, guildId: configuration.discordGuildId,
      userId: discordUserId, roleId, present: false,
    });
    removed.push(roleId);
  }
  if (desired && !member.roles.includes(desired)) {
    await discordSetMemberRole({
      botToken: configuration.botToken, guildId: configuration.discordGuildId,
      userId: discordUserId, roleId: desired, present: true,
    });
    added.push(desired);
  }
  return { status: added.length || removed.length ? "updated" : "unchanged", added, removed };
}
