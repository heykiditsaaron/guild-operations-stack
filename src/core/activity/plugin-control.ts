import { pool } from "../../db.js";

export type ActivityPluginFingerprint = {
  kind: string;
  label: string;
  firstRegisteredAtUnix: number;
  lastRegisteredAtUnix: number;
  lastPluginVersion: string | null;
};

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Activity plugin ${field} is required`);
  return normalized;
}

export async function rememberActivityPlugin(input: {
  kind: string;
  label: string;
  version?: string | null;
}): Promise<ActivityPluginFingerprint> {
  const kind = requiredText(input.kind, "kind");
  const label = requiredText(input.label, "label");
  const version = input.version == null ? null : requiredText(input.version, "version");
  const nowUnix = Math.floor(Date.now() / 1000);

  const result = await pool.query<{
    activity_kind: string;
    label: string;
    first_registered_at_unix: string;
    last_registered_at_unix: string;
    last_plugin_version: string | null;
  }>(
    `INSERT INTO activity_plugin_registrations (
       activity_kind,
       label,
       first_registered_at_unix,
       last_registered_at_unix,
       last_plugin_version
     )
     VALUES ($1,$2,$3,$3,$4)
     ON CONFLICT (activity_kind) DO UPDATE SET
       label = EXCLUDED.label,
       last_registered_at_unix = EXCLUDED.last_registered_at_unix,
       last_plugin_version = EXCLUDED.last_plugin_version
     RETURNING activity_kind, label, first_registered_at_unix, last_registered_at_unix, last_plugin_version`,
    [kind, label, nowUnix, version],
  );

  const row = result.rows[0];
  if (!row) throw new Error(`Activity plugin ${kind} registration fingerprint was not persisted`);
  return {
    kind: row.activity_kind,
    label: row.label,
    firstRegisteredAtUnix: Number(row.first_registered_at_unix),
    lastRegisteredAtUnix: Number(row.last_registered_at_unix),
    lastPluginVersion: row.last_plugin_version,
  };
}

export async function knownActivityPlugin(activityKind: string): Promise<ActivityPluginFingerprint | null> {
  const kind = requiredText(activityKind, "kind");
  const result = await pool.query<{
    activity_kind: string;
    label: string;
    first_registered_at_unix: string;
    last_registered_at_unix: string;
    last_plugin_version: string | null;
  }>(
    `SELECT activity_kind, label, first_registered_at_unix, last_registered_at_unix, last_plugin_version
       FROM activity_plugin_registrations
      WHERE activity_kind = $1`,
    [kind],
  );
  const row = result.rows[0];
  return row ? {
    kind: row.activity_kind,
    label: row.label,
    firstRegisteredAtUnix: Number(row.first_registered_at_unix),
    lastRegisteredAtUnix: Number(row.last_registered_at_unix),
    lastPluginVersion: row.last_plugin_version,
  } : null;
}

export async function knownActivityPlugins(): Promise<ActivityPluginFingerprint[]> {
  const result = await pool.query<{
    activity_kind: string;
    label: string;
    first_registered_at_unix: string;
    last_registered_at_unix: string;
    last_plugin_version: string | null;
  }>(
    `SELECT activity_kind, label, first_registered_at_unix, last_registered_at_unix, last_plugin_version
       FROM activity_plugin_registrations
      ORDER BY label, activity_kind`,
  );
  return result.rows.map((row) => ({
    kind: row.activity_kind,
    label: row.label,
    firstRegisteredAtUnix: Number(row.first_registered_at_unix),
    lastRegisteredAtUnix: Number(row.last_registered_at_unix),
    lastPluginVersion: row.last_plugin_version,
  }));
}
