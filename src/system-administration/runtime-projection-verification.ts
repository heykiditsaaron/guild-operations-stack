import { lstat } from "node:fs/promises";
import type { ComposeInvocation } from "./compose-invocation.js";

/**
 * The host executor must not bind-mount a missing projection (Docker may
 * create a directory at that path) or a publicly readable credential file.
 */
export async function verifyRuntimeProjectionFiles(invocation: ComposeInvocation): Promise<void> {
  const environment = invocation.environment;
  const paths = [
    environment.GO_RUNTIME_DATABASE_CONFIG_FILE,
    environment.GO_BUNDLED_POSTGRES_PASSWORD_FILE,
  ].filter((value): value is string => typeof value === "string");
  for (const path of paths) {
    const stat = await lstat(path);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0) {
      throw new Error("Runtime credential projection must be a private regular file");
    }
  }
}
