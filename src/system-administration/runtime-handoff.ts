import { resolve } from "node:path";
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
  const configuration = await readDatabaseConfiguration(authority);
  if (!configuration) throw new Error("Database is not configured in System Administration");
  const files = [await projectRuntimeDatabaseConfiguration(destination, authority)];
  if (configuration.mode === "bundled") {
    files.push(await projectBundledPostgresPassword(destination, authority));
  }
  return { mode: configuration.mode, files };
}
