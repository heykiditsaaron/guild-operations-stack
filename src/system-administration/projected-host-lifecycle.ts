import { join, resolve } from "node:path";
import { validateLifecycleRequest } from "./lifecycle-request.js";
import { readDatabaseConfiguration } from "./database-configuration.js";
import { executeHostLifecycle, type ComposeRunner } from "./host-lifecycle-executor.js";
import type { DockerInspect } from "./docker-volume-inspection.js";

/**
 * Host-only handoff adapter. Callers supply only an action; all deployment
 * details come from Administration state and a host-provisioned handoff root.
 * This does not expose an HTTP endpoint or confer host execution authority.
 */
export async function executeProjectedHostLifecycle(
  request: unknown,
  composeDirectory: string,
  administrationDirectory: string,
  handoffDirectory: string,
  inspect: DockerInspect,
  runner: ComposeRunner,
): Promise<void> {
  const validatedRequest = validateLifecycleRequest(request);
  if (!handoffDirectory.startsWith("/") || resolve(handoffDirectory) !== handoffDirectory) {
    throw new Error("Host handoff directory must be an absolute canonical path");
  }
  const authority = resolve(administrationDirectory);
  const handoff = resolve(handoffDirectory);
  if (handoff === authority || handoff.startsWith(authority + "/") || authority.startsWith(handoff + "/")) {
    throw new Error("Host handoff must be separate from Administration state");
  }
  const configuration = await readDatabaseConfiguration(administrationDirectory);
  if (!configuration) throw new Error("Database configuration is missing");
  const projection = {
    databaseConnectionFile: join(handoffDirectory, "database-connection.json"),
    ...(configuration.mode === "bundled" ? {
      bundledPasswordFile: join(handoffDirectory, "postgres-password"),
      bundledDatabase: configuration.database,
      bundledUsername: configuration.username,
    } : {}),
  };
  await executeHostLifecycle(
    validatedRequest, composeDirectory, administrationDirectory, projection, inspect, runner,
  );
}
