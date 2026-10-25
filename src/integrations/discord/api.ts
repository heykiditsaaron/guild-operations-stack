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
  // Manage Roles, View Channel, Send Messages, Embed Links,
  // Create Public Threads, Send Messages in Threads.
  // Channel-specific overrides remain authoritative in Discord.
  const permissions = (1n << 28n) | (1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 35n) | (1n << 38n);
  url.searchParams.set("permissions", permissions.toString());
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

export type DiscordChannel = { id: string; name?: string; type: number; parent_id?: string | null; permission_overwrites?: Array<{ id: string; type: number; allow: string; deny: string }> };
export const DISCORD_TEXT_CHANNEL = 0;
export const DISCORD_ANNOUNCEMENT_CHANNEL = 5;

export async function discordServerChannels(botToken: string, guildId: string): Promise<DiscordChannel[]> {
  return discordJson<DiscordChannel[]>(`${API}/guilds/${encodeURIComponent(guildId)}/channels`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
}

export type DiscordChannelPermissions = DiscordChannel & {
  permission_overwrites?: Array<{ id: string; type: number; allow: string; deny: string }>;
};

/** Calculate the bot's effective permissions for a guild text channel.
 * Discord applies @everyone, combined role, then member overwrites.
 */
export function discordChannelPublicationReadiness(input: {
  channel: DiscordChannelPermissions;
  guildId: string;
  botUserId: string;
  botRoleIds: string[];
  roles: DiscordRole[];
  requireThreads?: boolean;
}): { ready: boolean; reasons: string[] } {
  const { channel, guildId, botUserId, botRoleIds, roles } = input;
  const everyone = roles.find((role) => role.id === guildId);
  let permissions = BigInt(everyone?.permissions ?? "0");
  for (const role of roles) if (botRoleIds.includes(role.id)) permissions |= BigInt(role.permissions);
  const administrator = 1n << 3n;
  if (permissions & administrator) return { ready: true, reasons: [] };
  const overwrites = channel.permission_overwrites ?? [];
  const apply = (deny: bigint, allow: bigint) => { permissions = (permissions & ~deny) | allow; };
  const everyoneOverride = overwrites.find((item) => item.id === guildId && item.type === 0);
  if (everyoneOverride) apply(BigInt(everyoneOverride.deny), BigInt(everyoneOverride.allow));
  let roleDeny = 0n, roleAllow = 0n;
  for (const item of overwrites) {
    if (item.type === 0 && botRoleIds.includes(item.id)) {
      roleDeny |= BigInt(item.deny);
      roleAllow |= BigInt(item.allow);
    }
  }
  apply(roleDeny, roleAllow);
  const memberOverride = overwrites.find((item) => item.id === botUserId && item.type === 1);
  if (memberOverride) apply(BigInt(memberOverride.deny), BigInt(memberOverride.allow));
  const required = [
    { bit: 10n, name: "View Channel" },
    { bit: 11n, name: "Send Messages" },
    { bit: 14n, name: "Embed Links" },
    ...(input.requireThreads ? [
      { bit: 35n, name: "Create Public Threads" },
      { bit: 38n, name: "Send Messages in Threads" },
    ] : []),
  ];
  const reasons = required.filter(({ bit }) => !(permissions & (1n << bit)))
    .map(({ name }) => `Bot lacks ${name} in channel ${channel.name ?? channel.id}.`);
  return { ready: reasons.length === 0, reasons };
}

export async function discordChannelMessage(botToken: string, channelId: string, payload: unknown): Promise<{ id: string }> {
  return discordJson<{ id: string }>(`${API}/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST", headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Create a public thread attached to an existing announcement message. */
export async function discordStartMessageThread(
  botToken: string, channelId: string, messageId: string, name: string,
): Promise<{ id: string }> {
  return discordJson<{ id: string }>(
    `${API}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/threads`,
    {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, auto_archive_duration: 1440 }),
    },
  );
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

/** Application emojis belong to the Discord application, not the installed guild. */
export type DiscordApplicationEmoji = {
  id: string;
  name: string;
  animated?: boolean;
  available?: boolean;
};

export async function discordApplicationEmojis(botToken: string, applicationId: string): Promise<DiscordApplicationEmoji[]> {
  const response = await discordJson<{ items: DiscordApplicationEmoji[] }>(
    `${API}/applications/${encodeURIComponent(applicationId)}/emojis`,
    { headers: { Authorization: `Bot ${botToken}` } },
  );
  return response.items;
}

export async function discordCreateApplicationEmoji(input: {
  botToken: string;
  applicationId: string;
  name: string;
  imageData: string;
}): Promise<DiscordApplicationEmoji> {
  return discordJson<DiscordApplicationEmoji>(
    `${API}/applications/${encodeURIComponent(input.applicationId)}/emojis`,
    {
      method: "POST",
      headers: { Authorization: `Bot ${input.botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: input.name, image: input.imageData }),
    },
  );
}

/** Reconcile only an explicitly named asset; never modify unrelated emojis. */
export async function discordEnsureApplicationEmoji(input: {
  botToken: string;
  applicationId: string;
  name: string;
  imageData: string;
}): Promise<DiscordApplicationEmoji> {
  const existing = (await discordApplicationEmojis(input.botToken, input.applicationId))
    .find((emoji) => emoji.name === input.name);
  if (existing) return existing;
  return discordCreateApplicationEmoji(input);
}

export function discordApplicationEmojiMarkup(emoji: DiscordApplicationEmoji): string {
  return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
}
