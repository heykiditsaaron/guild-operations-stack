import {
  discordModuleConfiguration,
  discordModuleRuntimeConfiguration,
} from "../modules/discord/module-configuration.js";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const DISCORD_RATE_LIMIT_RETRIES = 4;

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

async function integrationConfig(): Promise<{ guildId: string; botToken: string }> {
  const current = await discordModuleRuntimeConfiguration();
  if (!current.enabled || !current.discordGuildId || !current.botToken) {
    throw new DiscordGuildIntegrationNotConfiguredError();
  }
  return { guildId: current.discordGuildId, botToken: current.botToken };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function retryAfterMilliseconds(response: Response): Promise<number | null> {
  try {
    const payload = await response.clone().json() as { retry_after?: unknown };
    if (typeof payload.retry_after === "number" && Number.isFinite(payload.retry_after) && payload.retry_after >= 0) {
      return Math.ceil(payload.retry_after * 1000);
    }
  } catch {
    // Fall through to response headers when Discord did not return the expected JSON body.
  }

  const retryAfter = response.headers.get("retry-after");
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  }

  const resetAfter = response.headers.get("x-ratelimit-reset-after");
  if (resetAfter !== null) {
    const seconds = Number(resetAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  }

  return null;
}

async function discordRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const { botToken } = await integrationConfig();

  for (let attempt = 0; attempt <= DISCORD_RATE_LIMIT_RETRIES; attempt += 1) {
    const response = await fetch(`${DISCORD_API_BASE}${path}`, {
      ...init,
      headers: {
        authorization: `Bot ${botToken}`,
        ...init.headers,
      },
    });

    if (response.status !== 429 || attempt === DISCORD_RATE_LIMIT_RETRIES) return response;

    const retryAfter = await retryAfterMilliseconds(response);
    if (retryAfter === null) return response;
    await wait(retryAfter);
  }

  throw new Error("Discord request retry loop exhausted unexpectedly");
}

export async function discordGuildIntegrationConfigured(): Promise<boolean> {
  const current = await discordModuleConfiguration();
  return current.enabled
    && Boolean(current.discordGuildId)
    && current.botTokenConfigured
    && current.secretEncryptionAvailable;
}

export async function getDiscordGuildMember(discordUserId: string): Promise<DiscordGuildMember | null> {
  const { guildId } = await integrationConfig();
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
  const { guildId } = await integrationConfig();
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
  const { guildId } = await integrationConfig();
  const response = await discordRequest(
    `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordUserId)}/roles/${encodeURIComponent(roleId)}`,
    { method: "PUT" },
  );
  if (!response.ok) throw new Error(`Discord role addition failed with ${response.status}`);
}

export async function removeDiscordGuildMemberRole(discordUserId: string, roleId: string): Promise<void> {
  const { guildId } = await integrationConfig();
  const response = await discordRequest(
    `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordUserId)}/roles/${encodeURIComponent(roleId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error(`Discord role removal failed with ${response.status}`);
}
