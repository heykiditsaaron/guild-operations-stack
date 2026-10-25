import { lstat, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ComposeInvocation } from "./compose-invocation.js";

/**
 * Host-provisioned trust root, independent of Administration requests.
 * Reject symbolic links and writable-by-others definitions. This checks
 * filesystem trust, not the semantic safety of a Compose definition.
 */
export async function verifyTrustedComposeFiles(
  invocation: ComposeInvocation,
  trustedDirectory: string,
): Promise<void> {
  if (!trustedDirectory || !trustedDirectory.startsWith("/")) {
    throw new Error("Host trusted Compose directory is not configured");
  }
  const root = resolve(trustedDirectory);
  if (await realpath(root) !== root) {
    throw new Error("Trusted Compose directory must not be a symbolic link");
  }
  const directory = await lstat(root);
  if (!directory.isDirectory() || (directory.mode & 0o022) !== 0) {
    throw new Error("Trusted Compose directory has unsafe permissions");
  }
  for (const path of [invocation.arguments[4], invocation.arguments[6]]) {
    if (typeof path !== "string" || dirname(path) !== root || await realpath(path) !== path) {
      throw new Error("Compose file is outside the trusted host directory");
    }
    const file = await lstat(path);
    if (!file.isFile() || (file.mode & 0o022) !== 0) {
      throw new Error("Compose file has unsafe permissions");
    }
  }
}
