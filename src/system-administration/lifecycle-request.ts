import { createDeploymentPlan, type DeploymentPlan } from "./deployment-plan.js";

/**
 * Administration-owned lifecycle intent. Callers cannot supply container names,
 * Compose arguments, paths, credentials, or executable commands.
 *
 * This is not a deployment executor. A separately authorized, constrained
 * executor must validate and execute an approved plan in a later milestone.
 */
export type LifecycleAction = "apply" | "start" | "stop";

export type LifecycleRequest = {
  schemaVersion: 1;
  action: LifecycleAction;
};

export type LifecycleIntent = {
  request: LifecycleRequest;
  plan: DeploymentPlan;
};

export function validateLifecycleRequest(value: unknown): LifecycleRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid lifecycle request");
  }
  const request = value as Record<string, unknown>;
  if (Object.keys(request).sort().join(",") !== "action,schemaVersion") {
    throw new Error("Unexpected lifecycle request fields");
  }
  if (request.schemaVersion !== 1) throw new Error("Unsupported lifecycle request version");
  if (request.action !== "apply" && request.action !== "start" && request.action !== "stop") {
    throw new Error("Unsupported lifecycle action");
  }
  return request as LifecycleRequest;
}

/** Derive scope from Administration state, never from untrusted request fields. */
export async function createLifecycleIntent(
  value: unknown,
  composeDirectory: string,
  administrationDirectory?: string,
): Promise<LifecycleIntent> {
  const request = validateLifecycleRequest(value);
  const plan = await createDeploymentPlan(composeDirectory, administrationDirectory);
  return { request, plan };
}
