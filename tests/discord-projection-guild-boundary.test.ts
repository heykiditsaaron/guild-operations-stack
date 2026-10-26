import assert from "node:assert/strict";
import { test } from "node:test";
import { belongsToActiveGuild } from "../src/integrations/discord/projection-guild-boundary.ts";

test("pending emissions from a previously bound guild cannot project after rebind", () => {
  const previousGuildId = "old-guild";
  const reboundGuildId = "new-guild";
  assert.equal(belongsToActiveGuild(previousGuildId, reboundGuildId), false);
});

test("existing projection records do not authorize delivery for another guild", () => {
  const projection = { discord_channel_id: "previous-channel", discord_message_id: "previous-message" };
  assert.ok(projection.discord_message_id);
  assert.equal(belongsToActiveGuild("previous-guild", "destination-guild"), false);
});

test("active guild events remain eligible, but missing provenance is rejected", () => {
  assert.equal(belongsToActiveGuild("destination-guild", "destination-guild"), true);
  assert.equal(belongsToActiveGuild(null, "destination-guild"), false);
  assert.equal(belongsToActiveGuild(undefined, "destination-guild"), false);
});
