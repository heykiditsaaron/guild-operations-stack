import { readFileSync } from "node:fs";

function hostValue(name: string, env: NodeJS.ProcessEnv): string | null {
  const direct = env[name]?.trim();
  const file = env[`${name}_FILE`]?.trim();
  if (direct && file) throw new Error(`Configure only one of ${name} or ${name}_FILE`);
  const value = file ? readFileSync(file, "utf8").trim() : direct;
  return value || null;
}

/** Blizzard application credentials are owned by the host, not guild state. */
export async function installationBlizzardConfiguration(env: NodeJS.ProcessEnv = process.env): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
  const clientId = hostValue("BLIZZARD_CLIENT_ID", env);
  const clientSecret = hostValue("BLIZZARD_CLIENT_SECRET", env);
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export async function installationBlizzardConfigured(): Promise<boolean> {
  return (await installationBlizzardConfiguration()) !== null;
}

export async function installationBlizzardEncryptedSecretExists(): Promise<boolean> {
  return false;
}
