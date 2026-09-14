import { config } from "./config.js";
import { pool } from "./db.js";

export const PACKAGED_MODULES = [
  { key: "raffle", label: "Raffle", defaultEnabled: true },
  { key: "raid", label: "Raid", defaultEnabled: true },
  { key: "discord", label: "Discord", defaultEnabled: false },
] as const;

export type PackagedModuleKey = (typeof PACKAGED_MODULES)[number]["key"];

export type PackagedModuleState = {
  key: PackagedModuleKey;
  label: string;
  available: true;
  enabled: boolean;
};

const moduleByKey = new Map<PackagedModuleKey, (typeof PACKAGED_MODULES)[number]>(
  PACKAGED_MODULES.map((module) => [module.key, module]),
);

export function isPackagedModuleKey(value: string): value is PackagedModuleKey {
  return moduleByKey.has(value as PackagedModuleKey);
}

export async function packagedModuleStates(
  guildId: string = config.guild.id,
): Promise<PackagedModuleState[]> {
  const result = await pool.query<{ module_key: string; enabled: boolean }>(
    `SELECT module_key, enabled
       FROM guild_module_enablement
      WHERE guild_id = $1`,
    [guildId],
  );
  const stored = new Map(result.rows.map((row) => [row.module_key, row.enabled]));

  return PACKAGED_MODULES.map((module) => ({
    key: module.key,
    label: module.label,
    available: true,
    enabled: stored.get(module.key) ?? module.defaultEnabled,
  }));
}

export async function packagedModuleEnabled(
  moduleKey: PackagedModuleKey,
  guildId: string = config.guild.id,
): Promise<boolean> {
  const module = moduleByKey.get(moduleKey);
  if (!module) return false;

  const result = await pool.query<{ enabled: boolean }>(
    `SELECT enabled
       FROM guild_module_enablement
      WHERE guild_id = $1
        AND module_key = $2`,
    [guildId, moduleKey],
  );
  return result.rows[0]?.enabled ?? module.defaultEnabled;
}

export async function setPackagedModuleEnabled(
  moduleKey: PackagedModuleKey,
  enabled: boolean,
  guildId: string = config.guild.id,
): Promise<PackagedModuleState> {
  const module = moduleByKey.get(moduleKey);
  if (!module) throw new Error(`Unknown packaged module: ${moduleKey}`);
  const nowUnix = Math.floor(Date.now() / 1000);

  await pool.query(
    `INSERT INTO guild_module_enablement (guild_id, module_key, enabled, updated_at_unix)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (guild_id, module_key) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       updated_at_unix = EXCLUDED.updated_at_unix`,
    [guildId, moduleKey, enabled, nowUnix],
  );

  if (moduleKey === "discord") {
    await pool.query(
      `INSERT INTO discord_module_settings (guild_id, enabled)
       VALUES ($1,$2)
       ON CONFLICT (guild_id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         updated_at = now()`,
      [guildId, enabled],
    );
  }

  return {
    key: module.key,
    label: module.label,
    available: true,
    enabled,
  };
}

export function packagedModuleForPath(pathname: string): PackagedModuleKey | null {
  if (pathname === "/events/raffle" || pathname.startsWith("/events/raffle/")) return "raffle";
  if (pathname === "/events/raid" || pathname.startsWith("/events/raid/")) return "raid";
  if (pathname === "/me/discord" || pathname.startsWith("/me/discord/") || pathname.startsWith("/auth/discord/")) return "discord";
  return null;
}
