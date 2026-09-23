import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { installationSecretKey } from "../../core/installation-secret.js";

const VERSION = "v1";

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", installationSecretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(value: string): string {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(":");
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Stored application secret has an unsupported format");
  }

  const decipher = createDecipheriv("aes-256-gcm", installationSecretKey(), Buffer.from(ivValue, "base64"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
