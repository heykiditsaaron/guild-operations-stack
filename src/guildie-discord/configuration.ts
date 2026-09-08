import {
  discordGuildIntegrationConfigured,
  getDiscordGuildRoles,
} from "./client.js";
import {
  guildDiscordProjectionSettings,
  replaceGuildDiscordProjectionSettings,
  type DiscordRankRoleMapping,
  type GuildDiscordProjectionSettings,
} from "./policy.js";
import { reconcileAllGuildieDiscordRoles } from "./roles.js";

export type ConfigureGuildDiscordProjectionInput = {
  enabled: boolean;
  linkedRoleId: string | null;
  rankRoles: DiscordRankRoleMapping[];
};

export class DiscordProjectionNotConfiguredError extends Error {
  constructor() {
    super("Direct Discord guild integration is not configured");
    this.name = "DiscordProjectionNotConfiguredError";
  }
}

export class UnknownDiscordProjectionRoleError extends Error {
  constructor(public readonly roleKind: "linked" | "rank") {
    super(`Unknown Discord ${roleKind} projection role`);
    this.name = "UnknownDiscordProjectionRoleError";
  }
}

export class DiscordProjectionReconciliationError extends Error {
  constructor(
    public readonly settings: GuildDiscordProjectionSettings,
    public readonly cause: unknown,
  ) {
    super("Discord projection reconciliation failed");
    this.name = "DiscordProjectionReconciliationError";
  }
}

export async function configureGuildDiscordProjection(
  input: ConfigureGuildDiscordProjectionInput,
): Promise<GuildDiscordProjectionSettings> {
  if (!discordGuildIntegrationConfigured()) {
    throw new DiscordProjectionNotConfiguredError();
  }

  const availableRoles = await getDiscordGuildRoles();
  const availableRoleIds = new Set(
    availableRoles.filter((role) => !role.managed).map((role) => role.id),
  );
  const linkedRoleId = input.linkedRoleId?.trim() || null;
  const rankRoles = input.rankRoles.map((mapping) => ({
    rankIndex: mapping.rankIndex,
    discordRoleId: mapping.discordRoleId.trim(),
  }));

  if (linkedRoleId && !availableRoleIds.has(linkedRoleId)) {
    throw new UnknownDiscordProjectionRoleError("linked");
  }
  if (rankRoles.some((mapping) => !availableRoleIds.has(mapping.discordRoleId))) {
    throw new UnknownDiscordProjectionRoleError("rank");
  }

  const previous = await guildDiscordProjectionSettings();
  const settings = await replaceGuildDiscordProjectionSettings({
    enabled: input.enabled,
    linkedRoleId,
    rankRoles,
  });
  const previousManagedRoleIds = [
    ...(previous.linkedRoleId ? [previous.linkedRoleId] : []),
    ...previous.rankRoles.map((mapping) => mapping.discordRoleId),
  ];

  try {
    await reconcileAllGuildieDiscordRoles({
      trigger: "admin-configuration",
      additionalManagedRoleIds: previousManagedRoleIds,
    });
  } catch (error) {
    throw new DiscordProjectionReconciliationError(settings, error);
  }

  return settings;
}
