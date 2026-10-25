import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectBundledClusterVolume } from "../src/system-administration/docker-volume-inspection.js";
import { assertBundledClusterContinuity } from "../src/system-administration/bundled-cluster-continuity.js";

test("missing managed volume permits first-time initialization", async () => {
  const state = await inspectBundledClusterVolume(async (args) => {
    assert.deepEqual(args, [
      "volume", "inspect", "guild-operations_guild-operations-db", "--format", "{{json .}}",
    ]);
    throw { code: 1, stderr: "Error response from daemon: get guild-operations_guild-operations-db: No such volume: guild-operations_guild-operations-db" };
  });
  assert.deepEqual(state, { kind: "absent" });
  assert.doesNotThrow(() => assertBundledClusterContinuity(state));
});

test("present Docker volume does not imply valid credentials or empty storage", async () => {
  const state = await inspectBundledClusterVolume(async () => ({
    stdout: JSON.stringify({
      Name: "guild-operations_guild-operations-db", Driver: "local",
      Mountpoint: "/var/lib/docker/volumes/guild-operations_guild-operations-db/_data",
    }),
  }));
  assert.deepEqual(state, { kind: "unknown" });
  assert.throws(() => assertBundledClusterContinuity(state), /could not be verified/);
});

test("Docker daemon failures and unexpected responses fail closed", async () => {
  for (const inspect of [
    async () => { throw { code: 1, stderr: "permission denied" }; },
    async () => ({ stdout: "not json" }),
    async () => ({ stdout: JSON.stringify({ Name: "unrelated", Driver: "local", Mountpoint: "/tmp" }) }),
  ]) {
    const state = await inspectBundledClusterVolume(inspect);
    assert.deepEqual(state, { kind: "unknown" });
  }
});
