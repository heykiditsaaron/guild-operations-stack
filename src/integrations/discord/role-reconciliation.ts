import { recordDiscordRoleAction } from "./role-action-history.js";
import { componentLogger } from "../../core/runtime-logger.js";

const log = componentLogger("discord.role-reconciliation");
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
  const knownRoles = new Set(roles.map((role) => role.id));
  // A deleted Discord role is already absent in practice; it cannot be removed via API.
  const currentManaged = managed.filter((id) => member.roles.includes(id) && knownRoles.has(id));
  const readiness = discordRoleReadiness({
    roles, botRoleIds: bot.roles, botUserId: configuration.botUserId,
    guildId: configuration.discordGuildId,
    mappedRoleIds: [...new Set([...mappings.map((mapping) => mapping.discordRoleId), ...currentManaged])],
  });
  if (!readiness.ready) return { status: "not_ready", reasons: readiness.reasons };

  // Identity is the subject; Core derives current authority from Blizzard-backed character facts.
  const rank = (await effectiveGuildAuthority(wowIdentityId, guildId))?.rankIndex;
  const desired = mappings.find((mapping) => mapping.rankIndex === rank)?.discordRoleId ?? null;
  const record = async (action: "grant" | "remove" | "reconcile", outcome: "succeeded" | "failed" | "not_ready", roleId?: string, detail?: string) => {
    try {
      await recordDiscordRoleAction({
        guildId, discordGuildId: configuration.discordGuildId!, discordUserId, wowIdentityId,
        discordRoleId: roleId, action, outcome, detail,
      });
    } catch (error) {
      // A history persistence failure must not alter Discord or Core authority.
      log.error({ err: error, discordUserId, action, outcome, roleId: roleId ?? null }, "Discord role action history persistence failed");
    }
  };
  const removed: string[] = [];
  const added: string[] = [];
  // Remove obsolete managed roles first, but never touch any unrelated Discord role.
  for (const roleId of currentManaged) {
    if (roleId === desired) continue;
    try {
      await discordSetMemberRole({
        botToken: configuration.botToken, guildId: configuration.discordGuildId,
        userId: discordUserId, roleId, present: false,
      });
      await record("remove", "succeeded", roleId, "Obsolete managed rank role");
      removed.push(roleId);
    } catch (error) {
      await record("remove", "failed", roleId, error instanceof Error ? error.message : "Discord API failed");
      throw error;
    }
  }
  if (desired && !member.roles.includes(desired)) {
    try {
      await discordSetMemberRole({
        botToken: configuration.botToken, guildId: configuration.discordGuildId,
        userId: discordUserId, roleId: desired, present: true,
      });
      await record("grant", "succeeded", desired, "Effective guild rank projection");
      added.push(desired);
    } catch (error) {
      await record("grant", "failed", desired, error instanceof Error ? error.message : "Discord API failed");
      throw error;
    }
  }
  return { status: added.length || removed.length ? "updated" : "unchanged", added, removed };
}
