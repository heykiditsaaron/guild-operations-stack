import { config } from "../../config.js";
import { effectiveGuildAuthority } from "../../guild-permissions.js";
import { publishOperationalRecord } from "../../operational-inspection.js";
import { discordAssociatedGuildieIds } from "./association.js";
import {
  addDiscordGuildMemberRole,
  getDiscordGuildMember,
  removeDiscordGuildMemberRole,
} from "./client.js";
import { guildDiscordProjectionSettings } from "./policy.js";
import { discordStateForGuildie } from "./state.js";

const BULK_DISCORD_CONCURRENCY = 5;

export type DiscordRoleEvaluation = {
  guildieId: string;
  associated: boolean;
  currentlyGuildMember: boolean;
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

export type DiscordRoleBulkReconciliation = {
  guildiesConsidered: number;
  guildiesEvaluated: number;
  guildiesAssociated: number;
  guildiesCurrentMembers: number;
  guildiesAlreadyConverged: number;
  guildiesNeedingChanges: number;
  plannedAdds: number;
  plannedRemoves: number;
  completedAdds: number;
  completedRemoves: number;
  failures: Array<{
    guildieId: string;
    stage: "evaluation" | "mutation";
    error: string;
  }>;
};

type ReconciliationContext = {
  trigger?: string;
  additionalManagedRoleIds?: string[];
};

type DisassociationContext = ReconciliationContext & {
  guildieId?: string;
};

type MutationResult = {
  evaluation: DiscordRoleEvaluation;
  addedRoleIds: string[];
  removedRoleIds: string[];
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

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  const results = new Array<PromiseSettledResult<R>>(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      try {
        results[index] = { status: "fulfilled", value: await mapper(values[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), values.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
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
  const currentlyGuildMember = authority !== null;

  const desiredRoleIds = new Set<string>();
  if (currentlyGuildMember && state.associated && state.presentInGuild && settings.linkedRoleId) {
    desiredRoleIds.add(settings.linkedRoleId);
  }
  if (currentlyGuildMember && state.associated && state.presentInGuild) {
    for (const roleId of desiredRankRoleIds(authority.rankIndex, settings.rankRoles)) {
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
    associated: state.associated,
    currentlyGuildMember,
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

async function executeEvaluation(evaluation: DiscordRoleEvaluation): Promise<MutationResult> {
  const addedRoleIds: string[] = [];
  const removedRoleIds: string[] = [];

  if (!evaluation.enabled || !evaluation.discordUserId || !evaluation.presentInGuild) {
    return { evaluation, addedRoleIds, removedRoleIds };
  }

  for (const roleId of evaluation.plannedAddRoleIds) {
    await addDiscordGuildMemberRole(evaluation.discordUserId, roleId);
    addedRoleIds.push(roleId);
  }
  for (const roleId of evaluation.plannedRemoveRoleIds) {
    await removeDiscordGuildMemberRole(evaluation.discordUserId, roleId);
    removedRoleIds.push(roleId);
  }

  return { evaluation, addedRoleIds, removedRoleIds };
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

  let mutation: MutationResult;
  try {
    mutation = await executeEvaluation(evaluation);
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
        currently_guild_member: evaluation.currentlyGuildMember,
        present_in_guild: evaluation.presentInGuild,
        observed_at: evaluation.observedAt,
        desired_role_ids: evaluation.desiredRoleIds,
        current_managed_role_ids: evaluation.currentManagedRoleIds,
        planned_add_role_ids: evaluation.plannedAddRoleIds,
        planned_remove_role_ids: evaluation.plannedRemoveRoleIds,
        error: errorText(error),
      },
    });
    throw error;
  }

  await publishBestEffort({
    source: "discord",
    operation: "roles.reconcile",
    kind: "result",
    result: "success",
    summary: mutation.addedRoleIds.length || mutation.removedRoleIds.length
      ? `Reconciled Discord roles for Guildie ${guildieId}.`
      : `Discord roles already matched desired state for Guildie ${guildieId}.`,
    details: {
      guildie_id: guildieId,
      discord_user_id: evaluation.discordUserId,
      trigger: context.trigger ?? null,
      currently_guild_member: evaluation.currentlyGuildMember,
      present_in_guild: evaluation.presentInGuild,
      observed_at: evaluation.observedAt,
      desired_role_ids: evaluation.desiredRoleIds,
      current_managed_role_ids: evaluation.currentManagedRoleIds,
      planned_add_role_ids: evaluation.plannedAddRoleIds,
      planned_remove_role_ids: evaluation.plannedRemoveRoleIds,
      added_role_ids: mutation.addedRoleIds,
      removed_role_ids: mutation.removedRoleIds,
    },
  });

  return {
    ...evaluation,
    addedRoleIds: mutation.addedRoleIds,
    removedRoleIds: mutation.removedRoleIds,
  };
}

async function reconcileGuildieSet(
  guildieIds: Iterable<string>,
  context: ReconciliationContext = {},
): Promise<DiscordRoleBulkReconciliation> {
  const uniqueGuildieIds = [...new Set(guildieIds)];
  const settings = await guildDiscordProjectionSettings();
  const failures: DiscordRoleBulkReconciliation["failures"] = [];

  const evaluationResults = await mapWithConcurrency(
    uniqueGuildieIds,
    BULK_DISCORD_CONCURRENCY,
    (guildieId) => evaluateGuildieDiscordRoles(guildieId, context),
  );

  const evaluations: DiscordRoleEvaluation[] = [];
  evaluationResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      evaluations.push(result.value);
      return;
    }
    failures.push({
      guildieId: uniqueGuildieIds[index],
      stage: "evaluation",
      error: errorText(result.reason),
    });
  });

  const needingChanges = evaluations.filter((evaluation) =>
    evaluation.plannedAddRoleIds.length > 0 || evaluation.plannedRemoveRoleIds.length > 0,
  );
  const plannedAdds = needingChanges.reduce((total, evaluation) => total + evaluation.plannedAddRoleIds.length, 0);
  const plannedRemoves = needingChanges.reduce((total, evaluation) => total + evaluation.plannedRemoveRoleIds.length, 0);
  let completedAdds = 0;
  let completedRemoves = 0;

  if (settings.enabled) {
    const mutationResults = await mapWithConcurrency(
      needingChanges,
      BULK_DISCORD_CONCURRENCY,
      async (evaluation) => executeEvaluation(evaluation),
    );

    mutationResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        completedAdds += result.value.addedRoleIds.length;
        completedRemoves += result.value.removedRoleIds.length;
        return;
      }
      failures.push({
        guildieId: needingChanges[index].guildieId,
        stage: "mutation",
        error: errorText(result.reason),
      });
    });
  }

  const summary: DiscordRoleBulkReconciliation = {
    guildiesConsidered: uniqueGuildieIds.length,
    guildiesEvaluated: evaluations.length,
    guildiesAssociated: evaluations.filter((evaluation) => evaluation.associated).length,
    guildiesCurrentMembers: evaluations.filter((evaluation) => evaluation.currentlyGuildMember).length,
    guildiesAlreadyConverged: evaluations.length - needingChanges.length,
    guildiesNeedingChanges: needingChanges.length,
    plannedAdds,
    plannedRemoves,
    completedAdds,
    completedRemoves,
    failures,
  };

  if (settings.enabled && (plannedAdds > 0 || plannedRemoves > 0 || failures.length > 0)) {
    const completedMutations = completedAdds + completedRemoves;
    const plannedMutations = plannedAdds + plannedRemoves;
    const result = failures.length === 0
      ? "success"
      : completedMutations > 0 || plannedMutations > 0
        ? "partial"
        : "failure";

    await publishBestEffort({
      source: "discord",
      operation: "roles.reconcile.bulk",
      kind: "result",
      result,
      summary: result === "success"
        ? `Reconciled Discord roles for ${summary.guildiesNeedingChanges} Guildies.`
        : `Discord bulk role reconciliation completed with ${failures.length} failure${failures.length === 1 ? "" : "s"}.`,
      details: {
        trigger: context.trigger ?? null,
        guildies_considered: summary.guildiesConsidered,
        guildies_evaluated: summary.guildiesEvaluated,
        guildies_associated: summary.guildiesAssociated,
        guildies_current_members: summary.guildiesCurrentMembers,
        guildies_already_converged: summary.guildiesAlreadyConverged,
        guildies_needing_changes: summary.guildiesNeedingChanges,
        planned_adds: summary.plannedAdds,
        planned_removes: summary.plannedRemoves,
        completed_adds: summary.completedAdds,
        completed_removes: summary.completedRemoves,
        failures: summary.failures.map((failure) => ({
          guildie_id: failure.guildieId,
          stage: failure.stage,
          error: failure.error,
        })),
      },
    });
  }

  return summary;
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
        error: errorText(error),
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
): Promise<DiscordRoleBulkReconciliation> {
  const guildieIds = await discordAssociatedGuildieIds();
  const result = await reconcileGuildieSet(guildieIds, context);
  if (result.failures.length > 0) {
    throw new Error(`Discord bulk reconciliation had ${result.failures.length} failure${result.failures.length === 1 ? "" : "s"}`);
  }
  return result;
}

export async function reconcileGuildiesBestEffort(
  guildieIds: Iterable<string>,
  context: ReconciliationContext = {},
): Promise<void> {
  const associated = await discordAssociatedGuildieIds();
  const result = await reconcileGuildieSet([...guildieIds, ...associated], context);
  for (const failure of result.failures) {
    console.error("Discord role reconciliation failed", {
      guildieId: failure.guildieId,
      stage: failure.stage,
      error: failure.error,
      guildId: config.guild.id,
    });
  }
}
