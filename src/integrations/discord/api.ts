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
  // MANAGE_ROLES (1 << 28). Discord still enforces the bot role hierarchy.
  url.searchParams.set("permissions", "268435456");
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
