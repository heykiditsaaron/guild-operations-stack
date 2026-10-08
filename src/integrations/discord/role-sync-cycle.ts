import { pool } from "../../db.js";
import type { DiscordIntegrationConfiguration } from "./configuration.js";
import { reconcileDiscordRankRole } from "./role-reconciliation.js";

export async function reconcileAssociatedDiscordRoles(input: {
  configuration: DiscordIntegrationConfiguration;
  guildId: string;
  offset: number;
  limit: number;
}): Promise<{ examined: number; updated: number; failures: number; nextOffset: number }> {
  if (!input.configuration.enabled || !input.configuration.discordGuildId || !input.configuration.applicationVerifiedAt) {
    return { examined: 0, updated: 0, failures: 0, nextOffset: 0 };
  }
  const result = await pool.query<{ wow_identity_id: string; discord_user_id: string }>(
    `SELECT a.wow_identity_id, d.discord_user_id
       FROM identity_wow_associations a
       JOIN discord_identities d ON d.identity_id = a.external_identity_id
      ORDER BY d.discord_user_id LIMIT $1 OFFSET $2`,
    [input.limit, input.offset],
  );
  let updated = 0;
  let failures = 0;
  for (const row of result.rows) {
    try {
      const outcome = await reconcileDiscordRankRole({
        configuration: input.configuration, guildId: input.guildId,
        wowIdentityId: row.wow_identity_id, discordUserId: row.discord_user_id,
      });
      if (outcome.status === "updated") updated++;
      if (outcome.status === "not_ready") {
        failures++;
        console.warn("Discord role synchronization not ready", { discordUserId: row.discord_user_id, reasons: outcome.reasons });
      }
    } catch (error) {
      failures++;
      console.error("Discord role synchronization failed", { discordUserId: row.discord_user_id, error });
    }
  }
  return {
    examined: result.rows.length, updated, failures,
    nextOffset: result.rows.length < input.limit ? 0 : input.offset + result.rows.length,
  };
}
