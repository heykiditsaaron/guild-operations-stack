import { installationGuildBinding, requireOperationalInstallationGuildBinding } from "../installation/guild-binding.js";
import { pool } from "../../db.js";

const DEFAULT_ACTIVITY_ENABLED = true;

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Activity plugin ${field} is required`);
  return normalized;
}

export async function activityPluginEnabled(activityKind: string, guildId?: string): Promise<boolean> {
  const kind = requiredText(activityKind, "kind");
  const resolvedGuildId = guildId ?? (await installationGuildBinding())?.guildId;
  if (!resolvedGuildId) return DEFAULT_ACTIVITY_ENABLED;

  const result = await pool.query<{ enabled: boolean }>(
    `SELECT enabled
       FROM guild_activity_plugin_enablement
      WHERE guild_id = $1
        AND activity_kind = $2`,
    [resolvedGuildId, kind],
  );
  return result.rows[0]?.enabled ?? DEFAULT_ACTIVITY_ENABLED;
}

export async function setActivityPluginEnabled(
  activityKind: string,
  enabled: boolean,
  guildId?: string,
): Promise<void> {
  const kind = requiredText(activityKind, "kind");
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  const nowUnix = Math.floor(Date.now() / 1000);

  await pool.query(
    `INSERT INTO guild_activity_plugin_enablement (guild_id, activity_kind, enabled, updated_at_unix)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (guild_id, activity_kind) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       updated_at_unix = EXCLUDED.updated_at_unix`,
    [resolvedGuildId, kind, enabled, nowUnix],
  );
}
