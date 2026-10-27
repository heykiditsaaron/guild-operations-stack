import assert from "node:assert/strict";
import { test } from "node:test";
import { articleEmissionGuildId, belongsToActiveGuild } from "../src/integrations/discord/projection-guild-boundary.ts";

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

test("article removal retains guild attribution after the source row is deleted", () => {
  const sourceGuild = articleEmissionGuildId("article.removed", undefined, "original-guild");
  assert.equal(belongsToActiveGuild(sourceGuild, "original-guild"), true);
  assert.equal(belongsToActiveGuild(sourceGuild, "new-guild"), false);
  assert.equal(articleEmissionGuildId("article.removed", undefined, undefined), undefined);
});

test("article edits use the current article owner rather than an emission parent", () => {
  assert.equal(articleEmissionGuildId("article.modified", "current-guild", "previous-guild"), "current-guild");
});
