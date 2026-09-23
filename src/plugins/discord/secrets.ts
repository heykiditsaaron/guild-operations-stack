import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function encryptionKey(): Buffer {
  const configured = process.env.APPLICATION_ENCRYPTION_KEY?.trim();
  if (!configured) {
    throw new Error("APPLICATION_ENCRYPTION_KEY is required to store or use configured secrets");
  }

  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) {
    throw new Error("APPLICATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

export function secretEncryptionAvailable(): boolean {
  const configured = process.env.APPLICATION_ENCRYPTION_KEY?.trim();
  if (!configured) return false;
  try {
    return Buffer.from(configured, "base64").length === 32;
  } catch {
    return false;
  }
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(value: string): string {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(":");
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Stored application secret has an unsupported format");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
