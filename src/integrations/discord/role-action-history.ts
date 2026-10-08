import { pool } from "../../db.js";

export type DiscordRoleAction = "grant" | "remove" | "reconcile";
export type DiscordRoleOutcome = "succeeded" | "failed" | "not_ready";

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
  await pool.query(
    `INSERT INTO discord_role_action_history
       (guild_id, discord_guild_id, discord_user_id, wow_identity_id, discord_role_id, action, outcome, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [input.guildId, input.discordGuildId, input.discordUserId, input.wowIdentityId,
     input.discordRoleId ?? null, input.action, input.outcome, input.detail?.slice(0, 500) ?? null],
  );
}

export async function recentDiscordRoleActions(guildId: string, limit = 50): Promise<Array<{
  occurredAt: Date;
  discordUserId: string;
  discordRoleId: string | null;
  action: DiscordRoleAction;
  outcome: DiscordRoleOutcome;
  detail: string | null;
}>> {
  const result = await pool.query<{
    occurred_at: Date; discord_user_id: string; discord_role_id: string | null;
    action: DiscordRoleAction; outcome: DiscordRoleOutcome; detail: string | null;
  }>(
    `SELECT occurred_at, discord_user_id, discord_role_id, action, outcome, detail
       FROM discord_role_action_history WHERE guild_id = $1
      ORDER BY occurred_at DESC, action_id DESC LIMIT $2`,
    [guildId, Math.min(Math.max(limit, 1), 100)],
  );
  return result.rows.map((row) => ({
    occurredAt: row.occurred_at, discordUserId: row.discord_user_id,
    discordRoleId: row.discord_role_id, action: row.action, outcome: row.outcome, detail: row.detail,
  }));
}
