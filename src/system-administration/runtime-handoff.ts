import { resolve, join } from "node:path";
import { lstat, readdir, rm } from "node:fs/promises";
import { readDatabaseConfiguration } from "./database-configuration.js";
import { projectRuntimeDatabaseConfiguration } from "./runtime-database-projection.js";
import { projectBundledPostgresPassword } from "./bundled-postgres-credentials.js";

/**
 * Explicit Administration-side projection. The destination must be a
 * dedicated private handoff directory; never the Administration state root.
 * Projection alone neither deploys services nor grants Docker access.
 */
export async function prepareRuntimeHandoff(
  destinationDirectory: string,
  administrationDirectory: string,
): Promise<{ mode: "bundled" | "external"; files: readonly string[] }> {
  const destination = resolve(destinationDirectory);
  const authority = resolve(administrationDirectory);
  if (!destinationDirectory.startsWith("/") || destination === authority ||
      destination.startsWith(authority + "/") ||
      authority.startsWith(destination + "/")) {
    throw new Error("Runtime handoff must be separate from Administration state");
  }
  // The projection helpers create this directory if absent. If it exists,
  // reject symlinks and permissions that expose projected credentials.
  try {
    const directory = await lstat(destination);
    if (!directory.isDirectory() || (directory.mode & 0o077) !== 0) {
      throw new Error("Runtime handoff directory must be private");
    }
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }
  // A reused handoff directory must not retain credentials from a previous
  // database mode. Refuse unrelated files rather than deleting host data.
  let entries: string[] = [];
  try { entries = await readdir(destination); } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }
  if (entries.some((entry) => !["database-connection.json", "postgres-password"].includes(entry))) {
    throw new Error("Runtime handoff directory contains unexpected files");
  }
  for (const entry of entries) {
    const stat = await lstat(join(destination, entry));
    if (!stat.isFile() || (stat.mode & 0o077) !== 0) {
      throw new Error("Runtime handoff contains an unsafe existing file");
    }
  }
  const configuration = await readDatabaseConfiguration(authority);
  if (!configuration) throw new Error("Database is not configured in System Administration");
  if (configuration.mode === "external" && entries.includes("postgres-password")) {
    await rm(join(destination, "postgres-password"));
  }
  const files = [await projectRuntimeDatabaseConfiguration(destination, authority)];
  if (configuration.mode === "bundled") {
    files.push(await projectBundledPostgresPassword(destination, authority));
  }
  return { mode: configuration.mode, files };
}
