import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { readDatabaseConfiguration, writeDatabaseConfiguration } from "./database-configuration.js";

/**
 * Establish credentials only for a new, unconfigured installation.
 * Never rotates a password for an existing PostgreSQL data volume.
 */
export async function configureNewBundledPostgres(directory: string): Promise<void> {
  if (await readDatabaseConfiguration(directory)) {
    throw new Error("Database is already configured; bundled credential replacement requires an explicit migration");
  }
  await writeDatabaseConfiguration({
    schemaVersion: 1,
    mode: "bundled",
    database: "guild_operations",
    username: "guild_operations",
    password: randomBytes(32).toString("hex"),
  }, directory);
}

/**
 * Project a password file for PostgreSQL's POSTGRES_PASSWORD_FILE interface.
 * Only the bundled database service may receive this file. This operation
 * does not apply or rotate credentials in an existing database cluster.
 */
export async function projectBundledPostgresPassword(
  destinationDirectory: string,
  administrationDirectory?: string,
): Promise<string> {
  const configuration = await readDatabaseConfiguration(administrationDirectory);
  if (!configuration || configuration.mode !== "bundled") {
    throw new Error("Bundled PostgreSQL configuration required");
  }
  await mkdir(destinationDirectory, { recursive: true, mode: 0o700 });
  const destination = join(destinationDirectory, "postgres-password");
  const temporary = join(destinationDirectory, ".postgres-password-" + randomUUID() + ".tmp");
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(configuration.password + "\n");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  return destination;
}
