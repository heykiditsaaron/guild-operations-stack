import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KEY_BYTES = 32;
const DATA_DIR = "/var/lib/guild-operations";
const KEY_PATH = join(DATA_DIR, "installation.key");

function decodeKey(value: string, source: string): Buffer {
  const key = Buffer.from(value.trim(), "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(`${source} must contain a base64-encoded ${KEY_BYTES}-byte key`);
  }
  return key;
}

function persistKey(key: Buffer): void {
  mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(KEY_PATH, `${key.toString("base64")}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  chmodSync(KEY_PATH, 0o600);
}

let cachedKey: Buffer | null = null;

export function installationSecretKey(): Buffer {
  if (cachedKey) return cachedKey;

  try {
    cachedKey = decodeKey(readFileSync(KEY_PATH, "utf8"), "Stored installation key");
    return cachedKey;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : null;
    if (code !== "ENOENT") throw error;
  }

  const legacy = process.env.APPLICATION_ENCRYPTION_KEY?.trim();
  const key = legacy
    ? decodeKey(legacy, "APPLICATION_ENCRYPTION_KEY")
    : randomBytes(KEY_BYTES);

  persistKey(key);
  cachedKey = key;
  return cachedKey;
}
