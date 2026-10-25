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
  const projectedPath = process.env.GUILD_OPERATIONS_DATABASE_CONFIG_FILE;
  if (projectedPath) {
    const projection = JSON.parse(readFileSync(projectedPath, "utf8")) as unknown;
    if (!projection || typeof projection !== "object" || Array.isArray(projection)) throw new Error("Invalid database runtime projection");
    const record = projection as Record<string, unknown>;
    if (Object.keys(record).sort().join(",") !== "connectionUrl,schemaVersion" || record.schemaVersion !== 1 || typeof record.connectionUrl !== "string") throw new Error("Invalid database runtime projection");
    let url: URL;
    try { url = new URL(record.connectionUrl); } catch { throw new Error("Invalid database runtime projection"); }
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || !url.pathname || url.pathname === "/") throw new Error("Invalid database runtime projection");
    return record.connectionUrl;
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
