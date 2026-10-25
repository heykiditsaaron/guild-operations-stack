import assert from "node:assert/strict";
import { test } from "node:test";
import { buildComposeInvocation } from "../src/system-administration/compose-invocation.js";
import { validateHostComposeInvocation } from "../src/system-administration/host-lifecycle-executor.js";
import type { DeploymentPlan } from "../src/system-administration/deployment-plan.js";

const plan: DeploymentPlan = {
  schemaVersion: 1, executor: "docker-compose", administrationStateDirectory: "/private/admin",
  composeFiles: ["/srv/go/compose.bundled.yaml", "/srv/go/compose.runtime.yaml"],
  services: ["db", "migrate", "api", "discord"], databaseMode: "bundled",
};
const projection = {
  databaseConnectionFile: "/run/go/database-connection.json",
  bundledPasswordFile: "/run/go/postgres-password",
  bundledDatabase: "guild_operations", bundledUsername: "guild_operations",
};

test("host process boundary accepts only generated apply and start invocations", () => {
  for (const action of ["apply", "start"] as const) {
    assert.doesNotThrow(() => validateHostComposeInvocation(
      buildComposeInvocation({ schemaVersion: 1, action }, plan, projection),
    ));
  }
});

test("host process boundary rejects forged Docker operations and environment", () => {
  const valid = buildComposeInvocation({ schemaVersion: 1, action: "apply" }, plan, projection);
  const forbidden = [
    { ...valid, arguments: ["ps"] },
    { ...valid, arguments: [...valid.arguments, "--privileged"] },
    { ...valid, arguments: valid.arguments.map((value) => value === "/srv/go/compose.bundled.yaml" ? "/tmp/arbitrary.yaml" : value) },
    { ...valid, environment: { ...valid.environment, DOCKER_HOST: "tcp://untrusted:2375" } },
    { ...valid, environment: { ...valid.environment, GO_RUNTIME_DATABASE_CONFIG_FILE: "relative.json" } },
  ];
  for (const invocation of forbidden) {
    assert.throws(() => validateHostComposeInvocation(invocation), /Unexpected|Absolute/);
  }
});

test("external topology has no bundled credential environment", () => {
  const external: DeploymentPlan = {
    ...plan, databaseMode: "external",
    composeFiles: ["/srv/go/compose.external.yaml", "/srv/go/compose.runtime.yaml"],
    services: ["migrate", "api", "discord"],
  };
  for (const action of ["apply", "start"] as const) {
    const invocation = buildComposeInvocation({ schemaVersion: 1, action }, external, {
      databaseConnectionFile: "/run/go/database-connection.json",
    });
    assert.doesNotThrow(() => validateHostComposeInvocation(invocation));
  }
});
