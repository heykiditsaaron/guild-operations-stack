import { readDatabaseConfiguration } from "./database-configuration.js";
import { readInstallationState } from "./state.js";

export type DeploymentReadiness =
  | { ready: true; databaseMode: "bundled" | "external" }
  | { ready: false; reasons: string[] };

/** Pure preflight: never starts containers or exposes database credentials. */
export async function deploymentReadiness(directory?: string): Promise<DeploymentReadiness> {
  const reasons: string[] = [];
  const installation = await readInstallationState(directory);
  if (!installation) reasons.push("System Administration is not initialized");
  const database = await readDatabaseConfiguration(directory);
  if (!database) reasons.push("Database configuration is missing");
  if (reasons.length) return { ready: false, reasons };
  return { ready: true, databaseMode: database!.mode };
}
