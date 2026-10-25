import assert from "node:assert/strict";
import test from "node:test";
import { discordChannelPublicationReadiness } from "../src/integrations/discord/api.js";

const guildId = "100";
const botUserId = "200";
const botRoleId = "300";
const required = [10n, 11n, 14n].reduce((bits, bit) => bits | (1n << bit), 0n);
const threadBits = (1n << 35n) | (1n << 38n);
const roles = [
  { id: guildId, name: "@everyone", position: 0, permissions: required.toString(), managed: false },
  { id: botRoleId, name: "Bot", position: 1, permissions: "0", managed: false },
];
const channel = { id: "400", name: "raids", type: 0 };
const check = (overwrites: Array<{ id: string; type: number; allow: string; deny: string }>, requireThreads = false) =>
  discordChannelPublicationReadiness({
    channel: { ...channel, permission_overwrites: overwrites },
    guildId, botUserId, botRoleIds: [botRoleId], roles, requireThreads,
  });
const overwrite = (id: string, type: number, allow = 0n, deny = 0n) =>
  ({ id, type, allow: allow.toString(), deny: deny.toString() });

test("guild permissions allow publication when no channel override exists", () => {
  assert.equal(check([]).ready, true);
});

test("@everyone channel denial removes Send Messages", () => {
  const result = check([overwrite(guildId, 0, 0n, 1n << 11n)]);
  assert.equal(result.ready, false);
  assert.match(result.reasons.join(" "), /Send Messages/);
});

test("role override restores permissions denied by @everyone override", () => {
  const result = check([
    overwrite(guildId, 0, 0n, 1n << 11n),
    overwrite(botRoleId, 0, 1n << 11n),
  ]);
  assert.equal(result.ready, true);
});

test("member override takes precedence over role allowance", () => {
  const result = check([
    overwrite(botRoleId, 0, 1n << 11n),
    overwrite(botUserId, 1, 0n, 1n << 11n),
  ]);
  assert.equal(result.ready, false);
  assert.match(result.reasons.join(" "), /Send Messages/);
});

test("member override can restore role-denied permission", () => {
  assert.equal(check([
    overwrite(botRoleId, 0, 0n, 1n << 11n),
    overwrite(botUserId, 1, 1n << 11n),
  ]).ready, true);
});

test("raffle channel requires thread permissions", () => {
  const result = check([], true);
  assert.equal(result.ready, false);
  assert.match(result.reasons.join(" "), /Create Public Threads/);
  assert.match(result.reasons.join(" "), /Send Messages in Threads/);
});

test("raffle channel passes with thread permissions", () => {
  const result = discordChannelPublicationReadiness({
    channel, guildId, botUserId, botRoleIds: [botRoleId],
    roles: [{ ...roles[0], permissions: (required | threadBits).toString() }, roles[1]],
    requireThreads: true,
  });
  assert.equal(result.ready, true);
});

test("administrator bypasses channel overrides", () => {
  const result = discordChannelPublicationReadiness({
    channel: { ...channel, permission_overwrites: [overwrite(guildId, 0, 0n, required)] },
    guildId, botUserId, botRoleIds: [botRoleId],
    roles: [roles[0], { ...roles[1], permissions: (1n << 3n).toString() }],
  });
  assert.equal(result.ready, true);
});
