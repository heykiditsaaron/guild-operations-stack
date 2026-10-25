import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { readDatabaseConfiguration } from "./database-configuration.js";
import { databaseConnectionString } from "./database-runtime.js";

/** Project only the connection details needed by GO, never the Administration store. */
export async function projectRuntimeDatabaseConfiguration(
  destinationDirectory: string,
  administrationDirectory?: string,
): Promise<string> {
  const configuration = await readDatabaseConfiguration(administrationDirectory);
  if (!configuration) throw new Error("Database is not configured in System Administration");
  await mkdir(destinationDirectory, { recursive: true, mode: 0o700 });
  const destination = join(destinationDirectory, "database-connection.json");
  const temporary = join(destinationDirectory, ".database-connection-" + randomUUID() + ".tmp");
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify({
      schemaVersion: 1,
      connectionUrl: databaseConnectionString(configuration),
    }) + "\n");
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
