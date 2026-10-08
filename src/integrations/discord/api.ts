import type { DiscordIntegrationConfiguration } from "./configuration.js";

const API = "https://discord.com/api/v10";

export type DiscordApplication = {
  id: string;
  name: string;
  verify_key?: string;
  bot?: { id: string; username: string };
};

export type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
};

async function discordJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`discord_api_${response.status}`);
  return response.json() as Promise<T>;
}

export async function currentDiscordApplication(botToken: string): Promise<DiscordApplication> {
  return discordJson<DiscordApplication>(`${API}/oauth2/applications/@me`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
}

export async function verifyDiscordApplication(configuration: DiscordIntegrationConfiguration): Promise<DiscordApplication> {
  const application = await currentDiscordApplication(configuration.botToken);
  if (application.id !== configuration.applicationId) throw new Error("discord_application_mismatch");
  return application;
}

export async function exchangeDiscordAuthorizationCode(input: {
  configuration: DiscordIntegrationConfiguration;
  code: string;
  redirectUri: string;
}): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
  });
  const basic = Buffer.from(`${input.configuration.applicationId}:${input.configuration.clientSecret}`).toString("base64");
  const token = await discordJson<{ access_token: string }>(`${API}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  return token.access_token;
}

export async function currentDiscordUser(accessToken: string): Promise<DiscordUser> {
  return discordJson<DiscordUser>(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export type DiscordGuildSummary = { id: string; name: string };

export function discordBotInstallUrl(applicationId: string): string {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", applicationId);
  url.searchParams.set("scope", "bot");
  // Manage Roles, View Channel, Send Messages, Embed Links.
  // Channel-specific overrides remain authoritative in Discord.
  url.searchParams.set("permissions", "268454912");
  return url.toString();
}

export async function discordBotGuilds(botToken: string): Promise<DiscordGuildSummary[]> {
  return discordJson<DiscordGuildSummary[]>(`${API}/users/@me/guilds`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
}

export async function verifiedDiscordServer(configuration: DiscordIntegrationConfiguration): Promise<DiscordGuildSummary> {
  const guilds = await discordBotGuilds(configuration.botToken);
  if (guilds.length === 0) throw new Error("discord_server_not_found");
  if (guilds.length !== 1) throw new Error("discord_server_binding_ambiguous");
  return guilds[0];
}


export type DiscordRole = {
  id: string;
  name: string;
  position: number;
  permissions: string;
  managed: boolean;
};

export type DiscordGuildMember = {
  roles: string[];
  user?: { id: string };
};

const MANAGE_ROLES = 1n << 28n;

export async function discordServerRoles(botToken: string, guildId: string): Promise<DiscordRole[]> {
  return discordJson<DiscordRole[]>(`${API}/guilds/${encodeURIComponent(guildId)}/roles`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
}

export async function discordServerMember(botToken: string, guildId: string, userId: string): Promise<DiscordGuildMember | null> {
  const response = await fetch(`${API}/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`discord_api_${response.status}`);
  return response.json() as Promise<DiscordGuildMember>;
}

export async function discordSetMemberRole(input: {
  botToken: string;
  guildId: string;
  userId: string;
  roleId: string;
  present: boolean;
}): Promise<void> {
  const response = await fetch(
    `${API}/guilds/${encodeURIComponent(input.guildId)}/members/${encodeURIComponent(input.userId)}/roles/${encodeURIComponent(input.roleId)}`,
    { method: input.present ? "PUT" : "DELETE", headers: { Authorization: `Bot ${input.botToken}` } },
  );
  if (!response.ok) throw new Error(`discord_api_${response.status}`);
}

/** Discord role positions can tie; role IDs break ties in Discord's hierarchy. */
export function discordRoleAbove(left: DiscordRole, right: DiscordRole): boolean {
  if (left.position !== right.position) return left.position > right.position;
  return BigInt(left.id) > BigInt(right.id);
}

export function discordRoleReadiness(input: {
  roles: DiscordRole[];
  botRoleIds: string[];
  botUserId: string;
  guildId: string;
  mappedRoleIds: string[];
}): { ready: boolean; reasons: string[] } {
  const roles = new Map(input.roles.map((role) => [role.id, role]));
  const botRoles = input.botRoleIds.map((id) => roles.get(id)).filter((role): role is DiscordRole => Boolean(role));
  const everyone = roles.get(input.guildId);
  const permissions = botRoles.reduce((bits, role) => bits | BigInt(role.permissions), BigInt(everyone?.permissions ?? "0"));
  const reasons: string[] = [];
  if ((permissions & MANAGE_ROLES) === 0n && (permissions & (1n << 3n)) === 0n) {
    reasons.push("Bot lacks Manage Roles permission; reauthorize the bot with Manage Roles.");
  }
  const highest = botRoles.sort((a, b) => discordRoleAbove(a, b) ? -1 : discordRoleAbove(b, a) ? 1 : 0)[0];
  for (const roleId of new Set(input.mappedRoleIds)) {
    const role = roles.get(roleId);
    if (!role) { reasons.push(`Mapped Discord role ${roleId} no longer exists.`); continue; }
    if (role.id === input.guildId || role.managed) {
      reasons.push(`Discord role "${role.name}" cannot be managed by a bot.`);
    } else if (!highest || !discordRoleAbove(highest, role)) {
      reasons.push(`Move the bot's highest role above "${role.name}" in Discord Server Settings.`);
    }
  }
  return { ready: reasons.length === 0, reasons };
}

export type DiscordChannel = { id: string; name?: string; type: number; parent_id?: string | null };
export const DISCORD_TEXT_CHANNEL = 0;
export const DISCORD_ANNOUNCEMENT_CHANNEL = 5;

export async function discordServerChannels(botToken: string, guildId: string): Promise<DiscordChannel[]> {
  return discordJson<DiscordChannel[]>(`${API}/guilds/${encodeURIComponent(guildId)}/channels`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
}

export async function discordChannelMessage(botToken: string, channelId: string, payload: unknown): Promise<{ id: string }> {
  return discordJson<{ id: string }>(`${API}/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST", headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function discordEditChannelMessage(botToken: string, channelId: string, messageId: string, payload: unknown): Promise<void> {
  const response = await fetch(`${API}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH", headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`discord_api_${response.status}`);
}

export async function discordDeleteChannelMessage(botToken: string, channelId: string, messageId: string): Promise<void> {
  const response = await fetch(`${API}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`, {
    method: "DELETE", headers: { Authorization: `Bot ${botToken}` },
  });
  if (!response.ok && response.status !== 404) throw new Error(`discord_api_${response.status}`);
}
