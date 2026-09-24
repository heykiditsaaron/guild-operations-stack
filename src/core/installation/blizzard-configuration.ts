import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { installationSecretKey } from "../installation-secret.js";
import { pool } from "../../db.js";

const VERSION = "v1";

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", installationSecretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

function decrypt(value: string): string {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(":");
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Stored Blizzard application secret has an unsupported format");
  }
  const decipher = createDecipheriv("aes-256-gcm", installationSecretKey(), Buffer.from(ivValue, "base64"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export async function installationBlizzardConfiguration(): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
  const result = await pool.query<{ client_id: string; client_secret_ciphertext: string }>(
    "SELECT client_id, client_secret_ciphertext FROM installation_blizzard_configuration WHERE singleton = true",
  );
  const row = result.rows[0];
  if (!row) return null;
  return { clientId: row.client_id, clientSecret: decrypt(row.client_secret_ciphertext) };
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
    [input.clientId.trim(), encrypt(input.clientSecret.trim())],
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
