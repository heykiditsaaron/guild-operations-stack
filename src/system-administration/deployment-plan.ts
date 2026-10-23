import { resolve } from "node:path";
import { deploymentReadiness } from "./deployment-readiness.js";
import { administrationDataDirectory } from "./state.js";

export type DeploymentPlan = {
  schemaVersion: 1;
  executor: "docker-compose";
  administrationStateDirectory: string;
  composeFiles: readonly string[];
  services: readonly string[];
  databaseMode: "bundled" | "external";
};

/**
 * Read-only deployment intent. A separate, constrained executor will consume
 * this plan; no Docker command, shell, or credential is executed here.
 */
export async function createDeploymentPlan(
  composeDirectory: string,
  administrationDirectory = administrationDataDirectory(),
): Promise<DeploymentPlan> {
  const readiness = await deploymentReadiness(administrationDirectory);
  if (!readiness.ready) throw new Error(`Deployment prerequisites incomplete: ${readiness.reasons.join("; ")}`);
  return {
    schemaVersion: 1,
    executor: "docker-compose",
    administrationStateDirectory: resolve(administrationDirectory),
    composeFiles: [resolve(composeDirectory, "compose.yaml")],
    services: readiness.databaseMode === "bundled"
      ? ["db", "migrate", "api", "discord"]
      : ["migrate", "api", "discord"],
    databaseMode: readiness.databaseMode,
  };
}
