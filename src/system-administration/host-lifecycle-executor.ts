import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { prepareLifecycleInvocation, type ComposeInvocation, type RuntimeProjectionPaths } from "./compose-invocation.js";
import type { DockerInspect } from "./docker-volume-inspection.js";
import { verifyTrustedComposeFiles } from "./trusted-compose-files.js";
import { verifyRuntimeProjectionFiles } from "./runtime-projection-verification.js";

const execFileAsync = promisify(execFile);

export type ComposeRunner = (invocation: ComposeInvocation) => Promise<void>;

const PROJECTION_KEYS = [
  "GO_RUNTIME_DATABASE_CONFIG_FILE",
  "GO_BUNDLED_POSTGRES_PASSWORD_FILE",
  "GO_BUNDLED_POSTGRES_DATABASE",
  "GO_BUNDLED_POSTGRES_USERNAME",
] as const;

/**
 * Validate again at the process boundary. An exported runner must never
 * execute an arbitrary Docker command even if passed a forged invocation.
 */
export function validateHostComposeInvocation(invocation: ComposeInvocation): void {
  if (invocation.executable !== "docker") throw new Error("Unsupported executor");
  const args = invocation.arguments;
  if (args.length < 10 || args[0] !== "compose" || args[1] !== "-p" ||
      args[2] !== "guild-operations" || args[3] !== "-f" ||
      args[5] !== "-f") throw new Error("Unexpected Docker Compose arguments");
  const base = args[4], overlay = args[6];
  if (!isAbsolute(base) || !isAbsolute(overlay) ||
      !["compose.bundled.yaml", "compose.external.yaml"].includes(basename(base)) ||
      basename(overlay) !== "compose.runtime.yaml" ||
      dirname(base) !== dirname(overlay) ||
      resolve(base) !== base || resolve(overlay) !== overlay) {
    throw new Error("Unexpected Docker Compose file scope");
  }
  const bundled = basename(base) === "compose.bundled.yaml";
  const tail = args.slice(7);
  const services = bundled ? ["db", "migrate", "api", "discord"] : ["migrate", "api", "discord"];
  const startServices = bundled ? ["db", "api", "discord"] : ["api", "discord"];
  const validApply = JSON.stringify(tail) === JSON.stringify(["up", "-d", ...services]);
  const validStart = JSON.stringify(tail) === JSON.stringify(["start", ...startServices]);
  if (!validApply && !validStart) throw new Error("Unexpected Docker Compose operation");
  const keys = Object.keys(invocation.environment).sort();
  const expectedKeys = bundled ? [...PROJECTION_KEYS].sort() : [PROJECTION_KEYS[0]];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    throw new Error("Unexpected executor environment");
  }
  for (const key of keys) {
    const value = invocation.environment[key];
    if (typeof value !== "string" || value.length === 0 ||
        value.includes("\0") || value.includes("\n")) {
      throw new Error("Invalid executor environment value");
    }
  }
  if (!isAbsolute(invocation.environment.GO_RUNTIME_DATABASE_CONFIG_FILE) ||
      (bundled && !isAbsolute(invocation.environment.GO_BUNDLED_POSTGRES_PASSWORD_FILE))) {
    throw new Error("Absolute projection paths required");
  }
}

/**
 * Host-only command runner. Never call this from the Administration HTTP
 * process. The caller must provide an independently authorized host context.
 * Do not return Docker stdout/stderr: they may contain sensitive values.
 */
export async function systemComposeRunner(invocation: ComposeInvocation): Promise<void> {
  validateHostComposeInvocation(invocation);
  await verifyTrustedComposeFiles(invocation, process.env.GO_TRUSTED_COMPOSE_DIRECTORY || "");
  await verifyRuntimeProjectionFiles(invocation);
  try {
    await execFileAsync("/usr/bin/docker", [...invocation.arguments], {
      env: {
        PATH: "/usr/bin:/bin",
        HOME: "/",
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
