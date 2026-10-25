import assert from "node:assert/strict";
import { test } from "node:test";
import { systemDockerInspect } from "../src/system-administration/docker-volume-inspection.js";

test("host volume inspector rejects commands outside its exact read-only contract", async () => {
  for (const args of [
    ["ps"], ["volume", "rm", "guild-operations_guild-operations-db"],
    ["volume", "inspect", "other-volume", "--format", "{{json .}}"],
    ["volume", "inspect", "guild-operations_guild-operations-db", "--format", "{{json .}}", "--help"],
  ]) {
    await assert.rejects(systemDockerInspect(args), /Unsupported Docker inspection/);
  }
});
