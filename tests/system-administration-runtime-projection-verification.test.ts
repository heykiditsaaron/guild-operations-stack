import assert from "node:assert/strict";
import { test } from "node:test";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyRuntimeProjectionFiles } from "../src/system-administration/runtime-projection-verification.js";
import type { ComposeInvocation } from "../src/system-administration/compose-invocation.js";

test("host rejects absent, public and symlinked credential projections", async () => {
  const root = await mkdtemp(join(tmpdir(), "go-projection-guard-"));
  const path = join(root, "database-connection.json");
  const invocation: ComposeInvocation = {
    executable: "docker", arguments: [],
    environment: { GO_RUNTIME_DATABASE_CONFIG_FILE: path },
  };
  try {
    await assert.rejects(verifyRuntimeProjectionFiles(invocation), /ENOENT/);
    await writeFile(path, "private", { mode: 0o600 });
    await verifyRuntimeProjectionFiles(invocation);
    await chmod(path, 0o644);
    await assert.rejects(verifyRuntimeProjectionFiles(invocation), /private regular file/);
    await rm(path);
    const target = join(root, "target");
    await writeFile(target, "private", { mode: 0o600 });
    await symlink(target, path);
    await assert.rejects(verifyRuntimeProjectionFiles(invocation), /private regular file/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
