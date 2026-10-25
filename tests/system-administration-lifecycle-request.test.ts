import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeInstallationState } from "../src/system-administration/state.js";
import { writeDatabaseConfiguration } from "../src/system-administration/database-configuration.js";
import { createLifecycleIntent, validateLifecycleRequest } from "../src/system-administration/lifecycle-request.js";

test("lifecycle request rejects arbitrary executor parameters", () => {
  for (const request of [
    null, [], "start", {},
    { schemaVersion: 2, action: "start" },
    { schemaVersion: 1, action: "exec" },
    { schemaVersion: 1, action: "start", command: "sh" },
    { schemaVersion: 1, action: "stop", services: ["administration"] },
    { schemaVersion: 1, action: "apply", composeFiles: ["/tmp/other.yaml"] },
    { schemaVersion: 1, action: "start", project: "another-project" },
  ]) {
    assert.throws(() => validateLifecycleRequest(request));
  }
  assert.deepEqual(validateLifecycleRequest({ schemaVersion: 1, action: "start" }), {
    schemaVersion: 1, action: "start",
  });
});

test("lifecycle intent fails closed without Administration readiness", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-lifecycle-"));
  try {
    await assert.rejects(
      createLifecycleIntent({ schemaVersion: 1, action: "apply" }, "/srv/go", directory),
      /prerequisites incomplete/,
    );
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("lifecycle intent derives services from Administration database mode", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-lifecycle-"));
  try {
    await initializeInstallationState(directory);
    await writeDatabaseConfiguration({
      schemaVersion: 1, mode: "external",
      connectionUrl: "postgresql://test:private@postgres.example/guild",
    }, directory);
    const intent = await createLifecycleIntent(
      { schemaVersion: 1, action: "stop" }, "/srv/go", directory,
    );
    assert.deepEqual(intent.plan.services, ["migrate", "api", "discord"]);
    assert.equal(intent.request.action, "stop");
    assert.ok(!JSON.stringify(intent).includes("private"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
