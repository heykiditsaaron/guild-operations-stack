import assert from "node:assert/strict";
import { test } from "node:test";
import { buildComposeInvocation } from "../src/system-administration/compose-invocation.js";
import type { DeploymentPlan } from "../src/system-administration/deployment-plan.js";

const bundled: DeploymentPlan = {
  schemaVersion: 1, executor: "docker-compose",
  administrationStateDirectory: "/private/admin",
  composeFiles: ["/srv/go/compose.bundled.yaml", "/srv/go/compose.runtime.yaml"],
  services: ["db", "migrate", "api", "discord"], databaseMode: "bundled",
};

test("bundled invocation is fixed-scope and contains no database password", () => {
  const invocation = buildComposeInvocation({ schemaVersion: 1, action: "apply" }, bundled, {
    databaseConnectionFile: "/run/go/database-connection.json",
    bundledPasswordFile: "/run/go/postgres-password",
    bundledDatabase: "guild_operations", bundledUsername: "guild_operations",
  });
  assert.equal(invocation.executable, "docker");
  assert.deepEqual(invocation.arguments, [
    "compose", "-p", "guild-operations", "-f", "/srv/go/compose.bundled.yaml",
    "-f", "/srv/go/compose.runtime.yaml", "up", "-d",
    "db", "migrate", "api", "discord",
  ]);
  assert.ok(!JSON.stringify(invocation).includes("/private/admin"));
  assert.ok(!JSON.stringify(invocation).includes("remove-orphans"));
});

test("external invocation cannot receive bundled secrets or services", () => {
  const external: DeploymentPlan = {
    ...bundled, databaseMode: "external",
    composeFiles: ["/srv/go/compose.external.yaml", "/srv/go/compose.runtime.yaml"],
    services: ["migrate", "api", "discord"],
  };
  const invocation = buildComposeInvocation({ schemaVersion: 1, action: "start" }, external, {
    databaseConnectionFile: "/run/go/database-connection.json",
  });
  assert.deepEqual(invocation.arguments.slice(-3), ["migrate", "api", "discord"]);
  assert.deepEqual(Object.keys(invocation.environment), ["GO_RUNTIME_DATABASE_CONFIG_FILE"]);
  assert.throws(() => buildComposeInvocation({ schemaVersion: 1, action: "start" }, external, {
    databaseConnectionFile: "/run/go/database-connection.json",
    bundledPasswordFile: "/run/go/postgres-password",
  }), /must not receive bundled/);
  assert.throws(() => buildComposeInvocation({ schemaVersion: 1, action: "start" }, {
    ...external, services: ["db", "migrate", "api", "discord"],
  }, { databaseConnectionFile: "/run/go/database-connection.json" }), /Unexpected deployment services/);
});
