import { readFileSync } from "node:fs";

export type HostDiscordCredentials = {
  applicationId: string;
  clientSecret: string;
  botToken: string;
};

function configuredValue(name: string, env: NodeJS.ProcessEnv): string | null {
  const direct = env[name]?.trim();
  const filePath = env[`${name}_FILE`]?.trim();
  if (direct && filePath) throw new Error(`Configure only one of ${name} or ${name}_FILE`);
  const value = filePath ? readFileSync(filePath, "utf8").trim() : direct;
  return value || null;
}

/** Installation-owned Discord credentials are provided by the host. */
export function hostDiscordCredentials(env: NodeJS.ProcessEnv = process.env): HostDiscordCredentials | null {
  const applicationId = configuredValue("DISCORD_APPLICATION_ID", env);
  const clientSecret = configuredValue("DISCORD_CLIENT_SECRET", env);
  const botToken = configuredValue("DISCORD_BOT_TOKEN", env);
  if (!applicationId && !clientSecret && !botToken) return null;
  if (!applicationId || !clientSecret || !botToken) throw new Error("Incomplete host Discord application credentials");
  if (!/^\d+$/.test(applicationId)) throw new Error("Invalid Discord application ID");
  return { applicationId, clientSecret, botToken };
}
