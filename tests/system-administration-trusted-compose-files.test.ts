import assert from "node:assert/strict";
import { test } from "node:test";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildComposeInvocation } from "../src/system-administration/compose-invocation.js";
import { verifyTrustedComposeFiles } from "../src/system-administration/trusted-compose-files.js";
import type { DeploymentPlan } from "../src/system-administration/deployment-plan.js";

test("host Compose trust root rejects unpinned, writable and symlinked definitions", async () => {
  const root = await mkdtemp(join(tmpdir(), "go-compose-trust-"));
  const base = join(root, "compose.external.yaml");
  const overlay = join(root, "compose.runtime.yaml");
  try {
    await writeFile(base, "services: {}\n", { mode: 0o600 });
    await writeFile(overlay, "services: {}\n", { mode: 0o600 });
    const plan: DeploymentPlan = {
      schemaVersion: 1, executor: "docker-compose",
      administrationStateDirectory: "/private/admin",
      composeFiles: [base, overlay],
      services: ["migrate", "api", "discord"], databaseMode: "external",
    };
    const invocation = buildComposeInvocation({ schemaVersion: 1, action: "apply" }, plan, {
      databaseConnectionFile: "/run/go/database-connection.json",
    });
    await assert.rejects(verifyTrustedComposeFiles(invocation, ""), /not configured/);
    await verifyTrustedComposeFiles(invocation, root);
    await chmod(base, 0o666);
    await assert.rejects(verifyTrustedComposeFiles(invocation, root), /unsafe permissions/);
    await chmod(base, 0o600);
    await rm(overlay);
    const target = join(root, "target.yaml");
    await writeFile(target, "services: {}\n");
    await symlink(target, overlay);
    await assert.rejects(verifyTrustedComposeFiles(invocation, root), /outside the trusted host directory/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
