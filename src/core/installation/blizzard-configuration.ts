import { decryptApplicationSecret, encryptApplicationSecret } from "../encrypted-secret.js";
import { pool } from "../../db.js";

export async function installationBlizzardConfiguration(): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
  const result = await pool.query<{ client_id: string; client_secret_ciphertext: string }>(
    "SELECT client_id, client_secret_ciphertext FROM installation_blizzard_configuration WHERE singleton = true",
  );
  const row = result.rows[0];
  if (!row) return null;
  return { clientId: row.client_id, clientSecret: decryptApplicationSecret(row.client_secret_ciphertext, "Blizzard application secret") };
}

export async function installationBlizzardConfigured(): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM installation_blizzard_configuration WHERE singleton = true) AS exists",
  );
  return result.rows[0]?.exists ?? false;
}

export async function installationBlizzardEncryptedSecretExists(): Promise<boolean> {
  return installationBlizzardConfigured();
}

export async function storeInstallationBlizzardConfiguration(input: {
  clientId: string;
  clientSecret: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO installation_blizzard_configuration (singleton, client_id, client_secret_ciphertext)
     VALUES (true, $1, $2)
     ON CONFLICT (singleton) DO UPDATE SET
       client_id = EXCLUDED.client_id,
       client_secret_ciphertext = EXCLUDED.client_secret_ciphertext,
       configured_at = now()`,
    [input.clientId.trim(), encryptApplicationSecret(input.clientSecret.trim())],
  );
}

export async function validateBlizzardApplicationCredentials(input: {
  clientId: string;
  clientSecret: string;
}): Promise<boolean> {
  const credentials = Buffer.from(`${input.clientId.trim()}:${input.clientSecret.trim()}`).toString("base64");
  const response = await fetch("https://oauth.battle.net/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!response.ok) return false;
  const payload = (await response.json()) as { access_token?: string };
  return Boolean(payload.access_token);
}
