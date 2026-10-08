import { publishOperationalRecord } from "../../operational-inspection.js";

export type DiscordRoleAction = "grant" | "remove" | "reconcile";
export type DiscordRoleOutcome = "succeeded" | "failed" | "not_ready";

/** Discord's operational channel in the shared Guild Operations log. */
export async function recordDiscordRoleAction(input: {
  guildId: string;
  discordGuildId: string;
  discordUserId: string;
  wowIdentityId: string;
  discordRoleId?: string | null;
  action: DiscordRoleAction;
  outcome: DiscordRoleOutcome;
  detail?: string | null;
}): Promise<void> {
  await publishOperationalRecord({
    source: "discord.role-sync",
    operation: input.action,
    kind: "result",
    result: input.outcome === "succeeded" ? "success" : "failure",
    summary: `Discord role ${input.action} ${input.outcome} for ${input.discordUserId}`,
    details: {
      guildId: input.guildId,
      discordGuildId: input.discordGuildId,
      discordUserId: input.discordUserId,
      wowIdentityId: input.wowIdentityId,
      discordRoleId: input.discordRoleId ?? null,
      outcome: input.outcome,
      detail: input.detail?.slice(0, 500) ?? null,
    },
  });
}
