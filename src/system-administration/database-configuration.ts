import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { administrationDataDirectory } from "./state.js";

export type DatabaseConfiguration =
  | { schemaVersion: 1; mode: "bundled"; database: string; username: string; password: string }
  | { schemaVersion: 1; mode: "external"; connectionUrl: string };

function validName(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(value);
}

export function validateDatabaseConfiguration(value: unknown): DatabaseConfiguration {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid database configuration");
  const v = value as Record<string, unknown>;
  if (v.schemaVersion !== 1) throw new Error("Unsupported database configuration version");
  if (v.mode === "bundled") {
    if (Object.keys(v).sort().join(",") !== "database,mode,password,schemaVersion,username") throw new Error("Invalid bundled database fields");
    if (!validName(v.database) || !validName(v.username) || typeof v.password !== "string" || v.password.length < 16 || v.password.length > 1024) throw new Error("Invalid bundled database credentials");
  } else if (v.mode === "external") {
    if (Object.keys(v).sort().join(",") !== "connectionUrl,mode,schemaVersion") throw new Error("Invalid external database fields");
    if (typeof v.connectionUrl !== "string" || v.connectionUrl.length > 4096) throw new Error("Invalid external database URL");
    let url: URL;
    try { url = new URL(v.connectionUrl); } catch { throw new Error("Invalid external database URL"); }
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || !url.pathname || url.pathname === "/") throw new Error("Invalid external PostgreSQL connection URL");
  } else throw new Error("Unsupported database mode");
  return v as DatabaseConfiguration;
}

export async function readDatabaseConfiguration(directory = administrationDataDirectory()): Promise<DatabaseConfiguration | null> {
  try {
    return validateDatabaseConfiguration(JSON.parse(await readFile(join(directory, "database-configuration.json"), "utf8")));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

/** Host-controlled desired configuration; does not change running application connections. */
export async function writeDatabaseConfiguration(value: unknown, directory = administrationDataDirectory()): Promise<void> {
  const configuration = validateDatabaseConfiguration(value);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  // Never replace malformed state silently.
  await readDatabaseConfiguration(directory);
  const temporary = join(directory, `.database-configuration-${randomUUID()}.tmp`);
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(configuration, null, 2) + "\n");
    await handle.sync();
  } finally { await handle.close(); }
  try { await rename(temporary, join(directory, "database-configuration.json")); }
  finally { await rm(temporary, { force: true }); }
}

export function publicDatabaseConfiguration(value: DatabaseConfiguration | null) {
  if (!value) return { configured: false as const };
  return { configured: true as const, mode: value.mode };
}
