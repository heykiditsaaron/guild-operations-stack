import { config } from "../config.js";

const DISCORD_API_BASE = "https://discord.com/api/v10";

export type DiscordGuildMember = {
  userId: string;
  roleIds: string[];
  nick: string | null;
  joinedAt: string | null;
  pending: boolean;
};

export type DiscordGuildRole = {
  id: string;
  name: string;
  position: number;
  managed: boolean;
};

export class DiscordGuildIntegrationNotConfiguredError extends Error {
  constructor() {
    super("Discord guild integration is not configured");
    this.name = "DiscordGuildIntegrationNotConfiguredError";
  }
}

function integrationConfig(): { guildId: string; botToken: string } {
  if (!config.discordGuildId || !config.discordBotToken) {
    throw new DiscordGuildIntegrationNotConfiguredError();
  }
  return { guildId: config.discordGuildId, botToken: config.discordBotToken };
}

async function discordRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const { botToken } = integrationConfig();
  return fetch(`${DISCORD_API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bot ${botToken}`,
      ...init.headers,
    },
  });
}

export function discordGuildIntegrationConfigured(): boolean {
  return Boolean(config.discordGuildId && config.discordBotToken);
}

export async function getDiscordGuildMember(discordUserId: string): Promise<DiscordGuildMember | null> {
  const { guildId } = integrationConfig();
  const response = await discordRequest(`/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordUserId)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Discord guild-member acquisition failed with ${response.status}`);

  const payload = await response.json() as {
    user?: { id?: unknown };
    roles?: unknown;
    nick?: unknown;
    joined_at?: unknown;
    pending?: unknown;
  };

  if (typeof payload.user?.id !== "string" || !Array.isArray(payload.roles) || !payload.roles.every((role) => typeof role === "string")) {
    throw new Error("Discord guild-member response lacked required fields");
  }

  return {
    userId: payload.user.id,
    roleIds: payload.roles,
    nick: typeof payload.nick === "string" ? payload.nick : null,
    joinedAt: typeof payload.joined_at === "string" ? payload.joined_at : null,
    pending: payload.pending === true,
  };
}

export async function getDiscordGuildRoles(): Promise<DiscordGuildRole[]> {
  const { guildId } = integrationConfig();
  const response = await discordRequest(`/guilds/${encodeURIComponent(guildId)}/roles`);
  if (!response.ok) throw new Error(`Discord guild-role acquisition failed with ${response.status}`);

  const payload = await response.json() as Array<{ id?: unknown; name?: unknown; position?: unknown; managed?: unknown }>;
  if (!Array.isArray(payload)) throw new Error("Discord guild-role response was not an array");

  return payload.map((role) => {
    if (typeof role.id !== "string" || typeof role.name !== "string" || typeof role.position !== "number") {
      throw new Error("Discord guild-role response lacked required fields");
    }
    return {
      id: role.id,
      name: role.name,
      position: role.position,
      managed: role.managed === true,
    };
  }).sort((a, b) => b.position - a.position);
}

export async function addDiscordGuildMemberRole(discordUserId: string, roleId: string): Promise<void> {
  const { guildId } = integrationConfig();
  const response = await discordRequest(
    `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordUserId)}/roles/${encodeURIComponent(roleId)}`,
    { method: "PUT" },
  );
  if (!response.ok) throw new Error(`Discord role addition failed with ${response.status}`);
}

export async function removeDiscordGuildMemberRole(discordUserId: string, roleId: string): Promise<void> {
  const { guildId } = integrationConfig();
  const response = await discordRequest(
    `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordUserId)}/roles/${encodeURIComponent(roleId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error(`Discord role removal failed with ${response.status}`);
}
