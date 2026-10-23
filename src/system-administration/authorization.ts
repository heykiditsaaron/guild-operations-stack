import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, open, readFile } from "node:fs/promises";
import { join } from "node:path";
import { administrationDataDirectory } from "./state.js";

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

function digest(token: string): string {
  return createHash("sha256").update(Buffer.from(token, "hex")).digest("hex");
}

export async function readAdministratorCredential(directory = administrationDataDirectory()): Promise<string | null> {
  let value: string;
  try {
    value = (await readFile(join(directory, "administrator-credential.sha256"), "utf8")).trim();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
  if (!HASH_PATTERN.test(value)) throw new Error("Invalid administrator credential state");
  return value;
}

/** Host-only bootstrap: prints a credential once, never serves it over HTTP. */
export async function establishAdministratorCredential(directory = administrationDataDirectory()): Promise<string> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (await readAdministratorCredential(directory)) throw new Error("Administrator credential already established");
  const token = randomBytes(32).toString("hex");
  const handle = await open(join(directory, "administrator-credential.sha256"), "wx", 0o600);
  try {
    await handle.writeFile(digest(token) + "\n");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(join(directory, "administrator-credential.sha256"), 0o600);
  return token;
}

export async function validAdministratorCredential(candidate: unknown, directory = administrationDataDirectory()): Promise<boolean> {
  if (typeof candidate !== "string" || !TOKEN_PATTERN.test(candidate)) return false;
  const stored = await readAdministratorCredential(directory);
  if (!stored) return false;
  return timingSafeEqual(Buffer.from(digest(candidate), "hex"), Buffer.from(stored, "hex"));
}
