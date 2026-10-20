import assert from "node:assert/strict";
import { test } from "node:test";
import { publishGuildRefreshObservation, registerGuildRefreshObserver } from "../src/core/guild/guild-refresh-observers.ts";

test("guild refresh observer failure does not prevent later observers from receiving the observation", async () => {
  const received: string[] = [];
  const observation = { guildId: "test-guild", changedIdentityIds: ["identity-a"] };

  registerGuildRefreshObserver(async (value) => {
    if (value !== observation) return;
    received.push("failing");
    throw new Error("observer unavailable");
  });
  registerGuildRefreshObserver(async (value) => {
    if (value !== observation) return;
    received.push("healthy");
    assert.equal(value.guildId, "test-guild");
    assert.deepEqual(value.changedIdentityIds, ["identity-a"]);
  });

  await assert.doesNotReject(publishGuildRefreshObservation(observation));
  assert.deepEqual(received, ["failing", "healthy"]);
});
