import assert from "node:assert/strict";
import test from "node:test";
import { discordApplicationReplacementState } from "../src/integrations/discord/configuration.js";

test("application replacement retains previously bound server for reconnection", () => {
  assert.deepEqual(
    discordApplicationReplacementState({ applicationId: "old", discordGuildId: "123" }, "new"),
    { previousServerId: "123" },
  );
});

test("application replacement without server binding still requires guild confirmation", () => {
  assert.deepEqual(
    discordApplicationReplacementState({ applicationId: "old", discordGuildId: null }, "new"),
    { previousServerId: null },
  );
});

test("rotating credentials for the same application does not require reconnection", () => {
  assert.equal(
    discordApplicationReplacementState({ applicationId: "same", discordGuildId: "123" }, "same"),
    null,
  );
});

test("missing host configuration or stored application is not replacement", () => {
  assert.equal(discordApplicationReplacementState({ applicationId: "old", discordGuildId: "123" }, null), null);
  assert.equal(discordApplicationReplacementState(null, "new"), null);
});
