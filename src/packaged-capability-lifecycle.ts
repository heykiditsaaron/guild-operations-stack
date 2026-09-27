import { requireOperationalInstallationGuildBinding } from "./core/installation/guild-binding.js";
import { pool } from "./db.js";

export const PACKAGED_CAPABILITIES = [
  { key: "discord", label: "Discord", kind: "plugin", defaultEnabled: false },
] as const;

export type PackagedCapabilityKey = (typeof PACKAGED_CAPABILITIES)[number]["key"];

export type PackagedCapabilityState = {
  key: PackagedCapabilityKey;
  label: string;
  kind: "module" | "plugin";
  available: true;
  enabled: boolean;
};

const capabilityByKey = new Map<PackagedCapabilityKey, (typeof PACKAGED_CAPABILITIES)[number]>(
  PACKAGED_CAPABILITIES.map((capability) => [capability.key, capability]),
);

export function isPackagedCapabilityKey(value: string): value is PackagedCapabilityKey {
  return capabilityByKey.has(value as PackagedCapabilityKey);
}

export async function packagedCapabilityStates(
  guildId?: string,
): Promise<PackagedCapabilityState[]> {
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  const result = await pool.query<{ module_key: string; enabled: boolean }>(
    `SELECT module_key, enabled
       FROM guild_module_enablement
      WHERE guild_id = $1`,
    [resolvedGuildId],
  );
  const stored = new Map(result.rows.map((row) => [row.module_key, row.enabled]));

  return PACKAGED_CAPABILITIES.map((capability) => ({
    key: capability.key,
    label: capability.label,
    kind: capability.kind,
    available: true,
    enabled: stored.get(capability.key) ?? capability.defaultEnabled,
  }));
}

export async function packagedCapabilityEnabled(
  capabilityKey: PackagedCapabilityKey,
  guildId?: string,
): Promise<boolean> {
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  const capability = capabilityByKey.get(capabilityKey);
  if (!capability) return false;

  const result = await pool.query<{ enabled: boolean }>(
    `SELECT enabled
       FROM guild_module_enablement
      WHERE guild_id = $1
        AND module_key = $2`,
    [resolvedGuildId, capabilityKey],
  );
  return result.rows[0]?.enabled ?? capability.defaultEnabled;
}

export async function setPackagedCapabilityEnabled(
  capabilityKey: PackagedCapabilityKey,
  enabled: boolean,
  guildId?: string,
): Promise<PackagedCapabilityState> {
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  const capability = capabilityByKey.get(capabilityKey);
  if (!capability) throw new Error(`Unknown packaged capability: ${capabilityKey}`);
  const nowUnix = Math.floor(Date.now() / 1000);

  await pool.query(
    `INSERT INTO guild_module_enablement (guild_id, module_key, enabled, updated_at_unix)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (guild_id, module_key) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       updated_at_unix = EXCLUDED.updated_at_unix`,
    [resolvedGuildId, capabilityKey, enabled, nowUnix],
  );

  if (capabilityKey === "discord") {
    await pool.query(
      `INSERT INTO discord_module_settings (guild_id, enabled)
       VALUES ($1,$2)
       ON CONFLICT (guild_id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         updated_at = now()`,
      [resolvedGuildId, enabled],
    );
  }

  return {
    key: capability.key,
    label: capability.label,
    kind: capability.kind,
    available: true,
    enabled,
  };
}

export function packagedCapabilityForPath(pathname: string): PackagedCapabilityKey | null {
  if (pathname === "/me/discord" || pathname.startsWith("/me/discord/") || pathname.startsWith("/auth/discord/")) return "discord";
  return null;
}
