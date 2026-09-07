import { config } from "../config.js";
import { pool } from "../db.js";
import { effectiveGuildAuthority } from "../guild-permissions.js";
import { publishOperationalRecord } from "../operational-inspection.js";
import {
  addDiscordGuildMemberRole,
  getDiscordGuildMember,
  removeDiscordGuildMemberRole,
} from "./client.js";
import { guildDiscordProjectionSettings } from "./policy.js";
import { discordStateForGuildie } from "./state.js";

export type DiscordRoleEvaluation = {
  guildieId: string;
  discordUserId: string | null;
  enabled: boolean;
  presentInGuild: boolean;
  observedAt: number;
  desiredRoleIds: string[];
  currentManagedRoleIds: string[];
  plannedAddRoleIds: string[];
  plannedRemoveRoleIds: string[];
};

export type DiscordRoleReconciliation = DiscordRoleEvaluation & {
  addedRoleIds: string[];
  removedRoleIds: string[];
};

type ReconciliationContext = {
  trigger?: string;
  additionalManagedRoleIds?: string[];
};

type DisassociationContext = ReconciliationContext & {
  guildieId?: string;
};

async function publishBestEffort(
  input: Parameters<typeof publishOperationalRecord>[0],
): Promise<void> {
  try {
    await publishOperationalRecord(input);
  } catch (error) {
    console.error("Discord operational inspection publication failed", error);
  }
}

function desiredRankRoleIds(
  effectiveRankIndex: number | null,
  mappings: Array<{ rankIndex: number; discordRoleId: string }>,
): string[] {
  if (effectiveRankIndex === null) return [];
  return mappings
    .filter((mapping) => mapping.rankIndex >= effectiveRankIndex)
    .map((mapping) => mapping.discordRoleId);
}

export async function evaluateGuildieDiscordRoles(
  guildieId: string,
  context: ReconciliationContext = {},
): Promise<DiscordRoleEvaluation> {
  const [settings, state, authority] = await Promise.all([
    guildDiscordProjectionSettings(),
    discordStateForGuildie(guildieId),
    effectiveGuildAuthority(guildieId),
  ]);

  const desiredRoleIds = new Set<string>();
  if (state.associated && state.presentInGuild && settings.linkedRoleId) {
    desiredRoleIds.add(settings.linkedRoleId);
  }
  if (state.associated && state.presentInGuild) {
    for (const roleId of desiredRankRoleIds(authority?.rankIndex ?? null, settings.rankRoles)) {
      desiredRoleIds.add(roleId);
    }
  }

  const managedRoleIds = new Set<string>([
    ...(settings.linkedRoleId ? [settings.linkedRoleId] : []),
    ...settings.rankRoles.map((mapping) => mapping.discordRoleId),
    ...(context.additionalManagedRoleIds ?? []),
  ]);
  const currentManagedRoleIds = state.roleIds.filter((roleId) => managedRoleIds.has(roleId));
  const plannedAddRoleIds = [...desiredRoleIds].filter((roleId) => !state.roleIds.includes(roleId));
  const plannedRemoveRoleIds = currentManagedRoleIds.filter((roleId) => !desiredRoleIds.has(roleId));

  return {
    guildieId,
    discordUserId: state.discordUserId,
    enabled: settings.enabled,
    presentInGuild: state.presentInGuild,
    observedAt: state.observedAt,
    desiredRoleIds: [...desiredRoleIds],
    currentManagedRoleIds,
    plannedAddRoleIds,
    plannedRemoveRoleIds,
  };
}

export async function reconcileGuildieDiscordRoles(
  guildieId: string,
  context: ReconciliationContext = {},
): Promise<DiscordRoleReconciliation> {
  const evaluation = await evaluateGuildieDiscordRoles(guildieId, context);

  if (!evaluation.enabled) {
    return {
      ...evaluation,
      addedRoleIds: [],
      removedRoleIds: [],
    };
  }

  const addedRoleIds: string[] = [];
  const removedRoleIds: string[] = [];

  try {
    if (evaluation.discordUserId && evaluation.presentInGuild) {
      for (const roleId of evaluation.plannedAddRoleIds) {
        await addDiscordGuildMemberRole(evaluation.discordUserId, roleId);
        addedRoleIds.push(roleId);
      }
      for (const roleId of evaluation.plannedRemoveRoleIds) {
        await removeDiscordGuildMemberRole(evaluation.discordUserId, roleId);
        removedRoleIds.push(roleId);
      }
    }
  } catch (error) {
    await publishBestEffort({
      source: "discord",
      operation: "roles.reconcile",
      kind: "exception",
      summary: "Discord role reconciliation did not complete.",
      details: {
        guildie_id: guildieId,
        discord_user_id: evaluation.discordUserId,
        trigger: context.trigger ?? null,
        present_in_guild: evaluation.presentInGuild,
        observed_at: evaluation.observedAt,
        desired_role_ids: evaluation.desiredRoleIds,
        current_managed_role_ids: evaluation.currentManagedRoleIds,
        planned_add_role_ids: evaluation.plannedAddRoleIds,
        planned_remove_role_ids: evaluation.plannedRemoveRoleIds,
        completed_add_role_ids: addedRoleIds,
        completed_remove_role_ids: removedRoleIds,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }

  await publishBestEffort({
    source: "discord",
    operation: "roles.reconcile",
    kind: "result",
    result: "success",
    summary: addedRoleIds.length || removedRoleIds.length
      ? `Reconciled Discord roles for Guildie ${guildieId}.`
      : `Discord roles already matched desired state for Guildie ${guildieId}.`,
    details: {
      guildie_id: guildieId,
      discord_user_id: evaluation.discordUserId,
      trigger: context.trigger ?? null,
      present_in_guild: evaluation.presentInGuild,
      observed_at: evaluation.observedAt,
      desired_role_ids: evaluation.desiredRoleIds,
      current_managed_role_ids: evaluation.currentManagedRoleIds,
      planned_add_role_ids: evaluation.plannedAddRoleIds,
      planned_remove_role_ids: evaluation.plannedRemoveRoleIds,
      added_role_ids: addedRoleIds,
      removed_role_ids: removedRoleIds,
    },
  });

  return {
    ...evaluation,
    addedRoleIds,
    removedRoleIds,
  };
}

export async function removeManagedDiscordRolesForUser(
  discordUserId: string,
  context: DisassociationContext = {},
): Promise<void> {
  const settings = await guildDiscordProjectionSettings();
  if (!settings.enabled) return;

  const member = await getDiscordGuildMember(discordUserId);
  if (!member) {
    await publishBestEffort({
      source: "discord",
      operation: "roles.reconcile",
      kind: "result",
      result: "success",
      summary: "Discord disassociation required no role removal because the user is not in the server.",
      details: {
        guildie_id: context.guildieId ?? null,
        discord_user_id: discordUserId,
        trigger: context.trigger ?? null,
        present_in_guild: false,
        removed_role_ids: [],
      },
    });
    return;
  }

  const managedRoleIds = new Set<string>([
    ...(settings.linkedRoleId ? [settings.linkedRoleId] : []),
    ...settings.rankRoles.map((mapping) => mapping.discordRoleId),
    ...(context.additionalManagedRoleIds ?? []),
  ]);
  const plannedRemoveRoleIds = member.roleIds.filter((roleId) => managedRoleIds.has(roleId));
  const removedRoleIds: string[] = [];

  try {
    for (const roleId of plannedRemoveRoleIds) {
      await removeDiscordGuildMemberRole(discordUserId, roleId);
      removedRoleIds.push(roleId);
    }
  } catch (error) {
    await publishBestEffort({
      source: "discord",
      operation: "roles.reconcile",
      kind: "exception",
      summary: "Discord role removal after disassociation did not complete.",
      details: {
        guildie_id: context.guildieId ?? null,
        discord_user_id: discordUserId,
        trigger: context.trigger ?? null,
        present_in_guild: true,
        managed_role_ids: [...managedRoleIds],
        planned_remove_role_ids: plannedRemoveRoleIds,
        completed_remove_role_ids: removedRoleIds,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }

  await publishBestEffort({
    source: "discord",
    operation: "roles.reconcile",
    kind: "result",
    result: "success",
    summary: removedRoleIds.length
      ? "Removed Guild Operations-managed Discord roles after disassociation."
      : "Discord disassociation required no managed role removal.",
    details: {
      guildie_id: context.guildieId ?? null,
      discord_user_id: discordUserId,
      trigger: context.trigger ?? null,
      present_in_guild: true,
      managed_role_ids: [...managedRoleIds],
      removed_role_ids: removedRoleIds,
    },
  });
}

export async function reconcileAllGuildieDiscordRoles(
  context: ReconciliationContext = {},
): Promise<void> {
  const result = await pool.query<{ guildie_id: string }>(
    "SELECT guildie_id FROM discord_associations ORDER BY guildie_id",
  );
  for (const row of result.rows) {
    await reconcileGuildieDiscordRoles(row.guildie_id, context);
  }
}

export async function reconcileGuildiesBestEffort(
  guildieIds: Iterable<string>,
  context: ReconciliationContext = {},
): Promise<void> {
  const uniqueGuildieIds = [...new Set(guildieIds)];
  const results = await Promise.allSettled(
    uniqueGuildieIds.map((guildieId) => reconcileGuildieDiscordRoles(guildieId, context)),
  );
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error("Discord role reconciliation failed", {
        guildieId: uniqueGuildieIds[index],
        error: result.reason,
        guildId: config.guild.id,
      });
    }
  });
}
