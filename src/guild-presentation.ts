import { guildState } from "./core/guild/guild-state.js";
import { config } from "./config.js";
import { pool } from "./db.js";

export type GuildPresentation = {
  guildName: string;
  realmName: string | null;
  region: string;
  wowArmoryUrl: string;
  raiderIoUrl: string | null;
  warcraftLogsUrl: string | null;
};

export type GuildPresentationDestinations = Pick<GuildPresentation, "raiderIoUrl" | "warcraftLogsUrl">;

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseGuildPresentationUrl(value: unknown): string | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  return httpUrl(value) ?? undefined;
}

function armoryUrl(region: string, realmSlug: string, guildNameSlug: string): string {
  const locale = region === "us" ? "en-us" : region === "eu" ? "en-gb" : region === "kr" ? "ko-kr" : "zh-tw";
  return `https://worldofwarcraft.blizzard.com/${locale}/worldsoul/${region}/armory/guild/${encodeURIComponent(realmSlug)}/${encodeURIComponent(guildNameSlug)}`;
}

export async function guildPresentation(): Promise<GuildPresentation> {
  const guild = await guildState();
  if (!guild) throw new Error("Guild presentation requires observed guild state");
  const result = await pool.query<{ raider_io_url: string | null; warcraft_logs_url: string | null }>(
    "SELECT raider_io_url, warcraft_logs_url FROM guild_presentation_settings WHERE guild_id = $1",
    [guild.guildId],
  );
  const settings = result.rows[0];
  return {
    guildName: guild.name,
    realmName: guild.realmName,
    region: guild.region.toUpperCase(),
    wowArmoryUrl: armoryUrl(guild.region, guild.realmSlug, config.guild.nameSlug),
    raiderIoUrl: httpUrl(settings?.raider_io_url),
    warcraftLogsUrl: httpUrl(settings?.warcraft_logs_url),
  };
}

export async function setGuildPresentationDestinations(
  destinations: GuildPresentationDestinations,
): Promise<GuildPresentationDestinations> {
  await pool.query(
    `INSERT INTO guild_presentation_settings (guild_id, raider_io_url, warcraft_logs_url, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (guild_id) DO UPDATE SET
       raider_io_url = EXCLUDED.raider_io_url,
       warcraft_logs_url = EXCLUDED.warcraft_logs_url,
       updated_at = now()`,
    [config.guild.id, destinations.raiderIoUrl, destinations.warcraftLogsUrl],
  );
  return destinations;
}
