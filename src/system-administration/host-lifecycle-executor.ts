import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prepareLifecycleInvocation, type ComposeInvocation, type RuntimeProjectionPaths } from "./compose-invocation.js";
import type { DockerInspect } from "./docker-volume-inspection.js";

const execFileAsync = promisify(execFile);

export type ComposeRunner = (invocation: ComposeInvocation) => Promise<void>;

const PROJECTION_KEYS = [
  "GO_RUNTIME_DATABASE_CONFIG_FILE",
  "GO_BUNDLED_POSTGRES_PASSWORD_FILE",
  "GO_BUNDLED_POSTGRES_DATABASE",
  "GO_BUNDLED_POSTGRES_USERNAME",
] as const;

/**
 * Host-only command runner. Never call this from the Administration HTTP
 * process. The caller must provide an independently authorized host context.
 * Do not return Docker stdout/stderr: they may contain sensitive values.
 */
export async function systemComposeRunner(invocation: ComposeInvocation): Promise<void> {
  if (invocation.executable !== "docker") throw new Error("Unsupported executor");
  const keys = Object.keys(invocation.environment);
  if (keys.some((key) => !PROJECTION_KEYS.includes(key as typeof PROJECTION_KEYS[number]))) {
    throw new Error("Unexpected executor environment");
  }
  try {
    await execFileAsync("docker", [...invocation.arguments], {
      env: {
        PATH: process.env.PATH || "/usr/bin:/bin",
        HOME: process.env.HOME || "/",
        ...invocation.environment,
      },
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
  } catch {
    throw new Error("Docker Compose operation failed; inspect host-side executor diagnostics");
  }
}

/**
 * No network-facing route or automatic scheduler invokes this function.
 * The caller owns host authorization and securely provisions projection files.
 * Volume checks run immediately before execution, not at plan creation.
 */
export async function executeHostLifecycle(
  request: unknown,
  composeDirectory: string,
  administrationDirectory: string,
  projection: RuntimeProjectionPaths,
  inspect: DockerInspect,
  runner: ComposeRunner,
): Promise<void> {
  const invocation = await prepareLifecycleInvocation(
    request, composeDirectory, administrationDirectory, projection, inspect,
  );
  await runner(invocation);
}
