import { readFileSync } from "node:fs";

/** Runtime database connectivity is supplied by the hosting operator. */
export function hostDatabaseConnectionString(env: NodeJS.ProcessEnv = process.env): string {
  const filePath = env.DATABASE_URL_FILE?.trim();
  const direct = env.DATABASE_URL?.trim();
  if (!filePath && !direct) throw new Error("Database connection is not configured: set DATABASE_URL or DATABASE_URL_FILE");
  const configured = filePath ? readFileSync(filePath, "utf8").trim() : direct!;
  if (!configured) throw new Error("Database connection URL is empty");
  let parsed: URL;
  try { parsed = new URL(configured); } catch { throw new Error("Invalid PostgreSQL connection URL"); }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || !parsed.username || !parsed.pathname || parsed.pathname === "/") {
    throw new Error("Database connection URL must be a PostgreSQL URL with username, host, and database");
  }
  return configured;
}
