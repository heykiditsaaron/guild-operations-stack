import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
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
    if (!isAbsolute(path) || resolve(path) !== path || await realpath(path) !== path) {
      throw new Error("Runtime credential projection requires a canonical absolute path");
    }
    for (let parent = dirname(path); ; parent = dirname(parent)) {
      const ancestor = await lstat(parent);
      if (!ancestor.isDirectory() || (ancestor.mode & 0o022) !== 0) {
        throw new Error("Runtime credential projection has an unsafe ancestor");
      }
      if (parent === dirname(parent)) break;
    }
    const stat = await lstat(path);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0) {
      throw new Error("Runtime credential projection must be a private regular file");
    }
  }
}
