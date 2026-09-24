import "dotenv/config";

export type Region = "us" | "eu" | "kr" | "tw";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const optional = (name: string): string | null => {
  const value = process.env[name]?.trim();
  return value ? value : null;
};

const port = 3100;

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
const development = process.env.GUILD_OPERATIONS_DEVELOPMENT === "true";

export const supportedRegions = new Set<Region>(["us", "eu", "kr", "tw"]);

export function parseRegion(value: unknown): Region | null {
  if (typeof value !== "string") return null;
  const region = value.toLowerCase() as Region;
  return supportedRegions.has(region) ? region : null;
}

export const config = {
  port,
  appOrigin,
  databaseUrl: "postgres://guild_operations:guild_operations@db:5432/guild_operations",
  blizzardRedirectUri: new URL("/auth/blizzard/callback", appOrigin).toString(),
  sessionCookieSecure: appOriginUrl.protocol === "https:",
  authAttemptTtlMinutes: 10,
  sessionTtlDays: 30,
  developmentAuthorityGuildieId: development ? optional("DEVELOPMENT_AUTHORITY_GUILDIE_ID") : null,
} as const;
