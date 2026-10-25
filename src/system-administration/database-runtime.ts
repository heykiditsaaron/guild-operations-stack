import { readFileSync } from "node:fs";
import { join } from "node:path";
import { administrationDataDirectory } from "./state.js";
import { validateDatabaseConfiguration, type DatabaseConfiguration } from "./database-configuration.js";

/** A runtime consumes Administration's explicit desired database state; no implicit credentials. */
export function databaseConnectionString(configuration: DatabaseConfiguration): string {
  if (configuration.mode === "external") return configuration.connectionUrl;
  const username = encodeURIComponent(configuration.username);
  const password = encodeURIComponent(configuration.password);
  const database = encodeURIComponent(configuration.database);
  return `postgresql://${username}:${password}@db:5432/${database}`;
}

export function runtimeDatabaseConnectionString(directory = administrationDataDirectory()): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) {
    let parsed: URL;
    try { parsed = new URL(configured); } catch { throw new Error("Invalid DATABASE_URL"); }
    if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || !parsed.username || !parsed.pathname || parsed.pathname === "/") {
      throw new Error("DATABASE_URL must be a PostgreSQL connection URL");
    }
    return configured;
  }
  let serialized: string;
  try {
    serialized = readFileSync(join(directory, "database-configuration.json"), "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error("Database is not configured in System Administration");
    }
    throw error;
  }
  return databaseConnectionString(validateDatabaseConfiguration(JSON.parse(serialized)));
}
