import { requireOperationalInstallationGuildBinding } from "../installation/guild-binding.js";
import { pool } from "../../db.js";

export const GUILD_THEMES = [
  { key: "default", label: "Default" },
  { key: "alliance", label: "Alliance" },
  { key: "horde", label: "Horde" },
] as const;

export type GuildThemeKey = (typeof GUILD_THEMES)[number]["key"];

export function isGuildThemeKey(value: string): value is GuildThemeKey {
  return GUILD_THEMES.some((theme) => theme.key === value);
}

export async function guildTheme(guildId?: string): Promise<GuildThemeKey> {
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  const result = await pool.query<{ theme_key: string }>(
    "SELECT theme_key FROM guild_presentation_settings WHERE guild_id = $1",
    [resolvedGuildId],
  );
  const key = result.rows[0]?.theme_key;
  return key && isGuildThemeKey(key) ? key : "default";
}

export async function setGuildTheme(themeKey: GuildThemeKey, guildId?: string): Promise<GuildThemeKey> {
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  await pool.query(
    `INSERT INTO guild_presentation_settings (guild_id, theme_key, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (guild_id) DO UPDATE SET theme_key = EXCLUDED.theme_key, updated_at = now()`,
    [resolvedGuildId, themeKey],
  );
  return themeKey;
}
