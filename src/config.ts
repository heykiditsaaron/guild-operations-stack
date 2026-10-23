import "dotenv/config";

export type Region = "us" | "eu" | "kr" | "tw";

const optional = (name: string): string | null => {
  const value = process.env[name]?.trim();
  return value ? value : null;
};

const port = 3100;
const development = process.env.GUILD_OPERATIONS_DEVELOPMENT === "true";

export const supportedRegions = new Set<Region>(["us", "eu", "kr", "tw"]);

export function parseRegion(value: unknown): Region | null {
  if (typeof value !== "string") return null;
  const region = value.toLowerCase() as Region;
  return supportedRegions.has(region) ? region : null;
}

export const config = {
  port,
  get databaseUrl(): string {
    const value = optional("DATABASE_URL");
    if (!value) throw new Error("Missing required environment variable: DATABASE_URL");
    return value;
  },
  authAttemptTtlMinutes: 10,
  sessionTtlDays: 30,
  developmentAuthorityGuildieId: development ? optional("DEVELOPMENT_AUTHORITY_GUILDIE_ID") : null,
} as const;
