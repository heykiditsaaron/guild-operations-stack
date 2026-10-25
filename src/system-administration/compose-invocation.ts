import { resolve } from "node:path";
import { createLifecycleIntent, type LifecycleRequest } from "./lifecycle-request.js";
import type { DeploymentPlan } from "./deployment-plan.js";

/**
 * Host-side executor contract. This prepares an allowlisted invocation only.
 * No Docker access is granted to the Administration web service.
 */
export type ComposeInvocation = {
  executable: "docker";
  arguments: readonly string[];
  environment: Readonly<Record<string, string>>;
};

export type RuntimeProjectionPaths = {
  databaseConnectionFile: string;
  bundledPasswordFile?: string;
  bundledDatabase?: string;
  bundledUsername?: string;
};

export function buildComposeInvocation(
  request: LifecycleRequest,
  plan: DeploymentPlan,
  projection: RuntimeProjectionPaths,
): ComposeInvocation {
  if (plan.schemaVersion !== 1 || plan.executor !== "docker-compose") {
    throw new Error("Unsupported deployment plan");
  }
  if (request.schemaVersion !== 1 || (request.action !== "apply" && request.action !== "start")) {
    throw new Error("Unsupported lifecycle action");
  }
  if (!projection.databaseConnectionFile || !projection.databaseConnectionFile.startsWith("/")) {
    throw new Error("Absolute database projection path required");
  }
  const bundled = plan.databaseMode === "bundled";
  if (bundled && (!projection.bundledPasswordFile?.startsWith("/") || !projection.bundledDatabase || !projection.bundledUsername)) {
    throw new Error("Bundled PostgreSQL projection is incomplete");
  }
  if (!bundled && (projection.bundledPasswordFile || projection.bundledDatabase || projection.bundledUsername)) {
    throw new Error("External PostgreSQL must not receive bundled credentials");
  }
  const base = plan.composeFiles[0];
  const overlay = plan.composeFiles[1];
  const expectedBase = bundled ? "compose.bundled.yaml" : "compose.external.yaml";
  if (plan.composeFiles.length !== 2 || base !== resolve(base, "..", expectedBase) ||
      overlay !== resolve(base, "..", "compose.runtime.yaml")) {
    throw new Error("Unexpected deployment Compose files");
  }
  const expectedServices = bundled ? ["db", "migrate", "api", "discord"] : ["migrate", "api", "discord"];
  if (plan.services.join(",") !== expectedServices.join(",")) {
    throw new Error("Unexpected deployment services");
  }
  const environment: Record<string, string> = {
    GO_RUNTIME_DATABASE_CONFIG_FILE: projection.databaseConnectionFile,
  };
  if (bundled) {
    environment.GO_BUNDLED_POSTGRES_PASSWORD_FILE = projection.bundledPasswordFile!;
    environment.GO_BUNDLED_POSTGRES_DATABASE = projection.bundledDatabase!;
    environment.GO_BUNDLED_POSTGRES_USERNAME = projection.bundledUsername!;
  }
  return {
    executable: "docker",
    arguments: [
      "compose", "-p", "guild-operations",
      "-f", base, "-f", overlay,
      "up", "-d",
      ...(request.action === "apply" ? ["--remove-orphans"] : []),
      ...plan.services,
    ],
    environment,
  };
}

/**
 * Derive plan from authoritative Administration state, never a caller-provided
 * plan. Actual execution and existing-volume checks remain separate.
 */
export async function prepareLifecycleInvocation(
  request: unknown,
  composeDirectory: string,
  administrationDirectory: string,
  projection: RuntimeProjectionPaths,
): Promise<ComposeInvocation> {
  const intent = await createLifecycleIntent(request, composeDirectory, administrationDirectory);
  return buildComposeInvocation(intent.request, intent.plan, projection);
}
