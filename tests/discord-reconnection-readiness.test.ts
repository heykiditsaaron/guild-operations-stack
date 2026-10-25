import assert from "node:assert/strict";
import test from "node:test";
import { discordRoleReadiness } from "../src/integrations/discord/api.js";

const guildId = "100";
const botId = "200";
const roles = [
  { id: guildId, name: "@everyone", position: 0, permissions: "0", managed: false },
  { id: "300", name: "Bot", position: 10, permissions: String(1n << 28n), managed: false },
  { id: "400", name: "Officer", position: 5, permissions: "0", managed: false },
];

test("replacement bot can manage a preserved role mapping when authorized and above it", () => {
  const result = discordRoleReadiness({
    roles, botRoleIds: ["300"], botUserId: botId, guildId, mappedRoleIds: ["400"],
  });
  assert.equal(result.ready, true);
  assert.deepEqual(result.reasons, []);
});

test("replacement bot cannot enable preserved role mappings when role is missing", () => {
  const result = discordRoleReadiness({
    roles, botRoleIds: ["300"], botUserId: botId, guildId, mappedRoleIds: ["999"],
  });
  assert.equal(result.ready, false);
  assert.match(result.reasons.join(" "), /no longer exists/);
});

test("replacement bot cannot manage preserved roles above its highest role", () => {
  const result = discordRoleReadiness({
    roles: roles.map((role) => role.id === "400" ? { ...role, position: 11 } : role),
    botRoleIds: ["300"], botUserId: botId, guildId, mappedRoleIds: ["400"],
  });
  assert.equal(result.ready, false);
  assert.match(result.reasons.join(" "), /highest role above/);
});

test("replacement bot without Manage Roles cannot enable mapped roles", () => {
  const result = discordRoleReadiness({
    roles: roles.map((role) => role.id === "300" ? { ...role, permissions: "0" } : role),
    botRoleIds: ["300"], botUserId: botId, guildId, mappedRoleIds: ["400"],
  });
  assert.equal(result.ready, false);
  assert.match(result.reasons.join(" "), /Manage Roles/);
});
