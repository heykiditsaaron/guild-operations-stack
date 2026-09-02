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

export const config = {
  port,
  databaseUrl: required("DATABASE_URL"),
  blizzardClientId: required("BLIZZARD_CLIENT_ID"),
  blizzardClientSecret: required("BLIZZARD_CLIENT_SECRET"),
  blizzardRedirectUri: required("BLIZZARD_REDIRECT_URI"),
  sessionCookieSecure: (process.env.SESSION_COOKIE_SECURE ?? "false") === "true",
  authAttemptTtlMinutes: 10,
  sessionTtlDays: 30,
} as const;

export const supportedRegions = new Set<Region>(["us", "eu", "kr", "tw"]);

export function parseRegion(value: unknown): Region | null {
  if (typeof value !== "string") return null;
  const region = value.toLowerCase() as Region;
  return supportedRegions.has(region) ? region : null;
}
