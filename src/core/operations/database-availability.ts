import { pool } from "../../db.js";

export function isDatabaseUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && (
    code.startsWith("08") ||
    ["57P01", "57P02", "57P03", "53300", "ECONNREFUSED", "ECONNRESET", "EPIPE", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code)
  );
}

/** Verify connectivity and the installation schema without relying on cached state. */
export async function databaseReady(): Promise<boolean> {
  try {
    await pool.query("SELECT 1 FROM installation_guild_binding LIMIT 1");
    return true;
  } catch (error) {
    if (isDatabaseUnavailable(error)) return false;
    throw error;
  }
}
