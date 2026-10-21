import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const directory = "/var/lib/guild-operations";
const path = `${directory}/setup-authorization.token`;
let cached: string | null = null;

export function setupAuthorizationToken(): string {
  if (cached) return cached;
  try {
    cached = readFileSync(path, "utf8").trim();
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const generated = randomBytes(32).toString("hex");
    try {
      writeFileSync(path, generated + "\n", { flag: "wx", mode: 0o600 });
      cached = generated;
    } catch (writeError) {
      if (!(writeError && typeof writeError === "object" && "code" in writeError && writeError.code === "EEXIST")) throw writeError;
      cached = readFileSync(path, "utf8").trim();
    }
  }
  if (!cached || !/^[a-f0-9]{64}$/.test(cached)) throw new Error("Invalid installation setup authorization token");
  return cached;
}

export function validSetupAuthorization(candidate: unknown): boolean {
  if (typeof candidate !== "string" || !/^[a-f0-9]{64}$/.test(candidate)) return false;
  return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(setupAuthorizationToken(), "hex"));
}
