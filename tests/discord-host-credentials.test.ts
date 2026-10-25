import assert from "node:assert/strict";
import { test } from "node:test";
import { hostDiscordCredentials } from "../src/integrations/discord/host-credentials.js";

test("Discord credentials are optional when integration is not provisioned", () => {
  assert.equal(hostDiscordCredentials({}), null);
});

test("Discord credentials are resolved together from the host", () => {
  assert.deepEqual(hostDiscordCredentials({
    DISCORD_APPLICATION_ID: "123456789",
    DISCORD_CLIENT_SECRET: "client-secret",
    DISCORD_BOT_TOKEN: "bot-token",
  }), { applicationId: "123456789", clientSecret: "client-secret", botToken: "bot-token" });
});

test("partial Discord host configuration fails closed", () => {
  assert.throws(() => hostDiscordCredentials({ DISCORD_APPLICATION_ID: "123" }), /Incomplete/);
});

test("invalid Discord application IDs are rejected", () => {
  assert.throws(() => hostDiscordCredentials({
    DISCORD_APPLICATION_ID: "not-an-id",
    DISCORD_CLIENT_SECRET: "secret",
    DISCORD_BOT_TOKEN: "token",
  }), /Invalid Discord application ID/);
});

test("direct and file sources cannot both be configured", () => {
  assert.throws(() => hostDiscordCredentials({
    DISCORD_APPLICATION_ID: "123",
    DISCORD_APPLICATION_ID_FILE: "/unused",
  }), /only one/);
});
