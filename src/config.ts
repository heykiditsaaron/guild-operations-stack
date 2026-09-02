import "dotenv/config";

export type Region = "us" | "eu" | "kr" | "tw";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const port = Number(process.env.PORT ?? "3100");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port");
}

const appOriginUrl = new URL(required("APP_ORIGIN"));
if (appOriginUrl.protocol !== "http:" && appOriginUrl.protocol !== "https:") {
  throw new Error("APP_ORIGIN must use http or https");
}
if (
  appOriginUrl.pathname !== "/" ||
  appOriginUrl.search ||
  appOriginUrl.hash ||
  appOriginUrl.username ||
  appOriginUrl.password
) {
  throw new Error("APP_ORIGIN must contain only scheme, host, and optional port");
}
const appOrigin = appOriginUrl.origin;

export const supportedRegions = new Set<Region>(["us", "eu", "kr", "tw"]);

export function parseRegion(value: unknown): Region | null {
  if (typeof value !== "string") return null;
  const region = value.toLowerCase() as Region;
  return supportedRegions.has(region) ? region : null;
}

const guildRegion = parseRegion(required("GUILD_REGION"));
if (!guildRegion) throw new Error("GUILD_REGION must be a supported Blizzard region");

export const config = {
  port,
  appOrigin,
  databaseUrl: required("DATABASE_URL"),
  blizzardClientId: required("BLIZZARD_CLIENT_ID"),
  blizzardClientSecret: required("BLIZZARD_CLIENT_SECRET"),
  blizzardRedirectUri: new URL("/auth/blizzard/callback", appOrigin).toString(),
  discordClientId: required("DISCORD_CLIENT_ID"),
  discordClientSecret: required("DISCORD_CLIENT_SECRET"),
  discordRedirectUri: new URL("/auth/discord/callback", appOrigin).toString(),
  sessionCookieSecure: (process.env.SESSION_COOKIE_SECURE ?? "false") === "true",
  authAttemptTtlMinutes: 10,
  sessionTtlDays: 30,
  guild: {
    id: required("GUILD_BLIZZARD_ID"),
    region: guildRegion,
    realmSlug: required("GUILD_REALM_SLUG"),
    nameSlug: required("GUILD_NAME_SLUG"),
  },
} as const;
