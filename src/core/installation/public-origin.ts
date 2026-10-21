import type { FastifyRequest } from "fastify";
import { pool } from "../../db.js";

function firstHeaderValue(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  // Do not silently accept the first value from a potentially forged chain.
  if (!raw || raw.includes(",")) return null;
  return raw.trim() || null;
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Installation public origin must use http or https");
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) throw new Error("Installation public origin must contain only scheme, host, and optional port");
  return url.origin;
}

export function publicOriginForRequest(request: FastifyRequest): string {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const forwardedHost = request.headers["x-forwarded-host"];
  if ((forwardedProto !== undefined && !firstHeaderValue(forwardedProto)) ||
      (forwardedHost !== undefined && !firstHeaderValue(forwardedHost))) {
    throw new Error("Ambiguous forwarded origin headers");
  }
  const protocol = firstHeaderValue(forwardedProto) ?? request.protocol;
  const host = firstHeaderValue(forwardedHost) ?? request.headers.host;
  if (!host || Array.isArray(host)) throw new Error("Request did not provide a public host");
  return normalizeOrigin(`${protocol}://${host}`);
}

export async function installationPublicOrigin(): Promise<string | null> {
  const result = await pool.query<{ public_origin: string }>("SELECT public_origin FROM installation_web_configuration WHERE singleton = true");
  return result.rows[0]?.public_origin ?? null;
}

export async function requireInstallationPublicOrigin(): Promise<string> {
  const origin = await installationPublicOrigin();
  if (!origin) throw new Error("Installation public origin has not been established");
  return origin;
}

export async function establishInstallationPublicOrigin(origin: string): Promise<string> {
  const normalized = normalizeOrigin(origin);
  await pool.query(`INSERT INTO installation_web_configuration (singleton, public_origin) VALUES (true, $1) ON CONFLICT (singleton) DO NOTHING`, [normalized]);
  const established = await requireInstallationPublicOrigin();
  if (established !== normalized) throw new Error(`Installation public origin is already established as ${established}`);
  return established;
}

export async function installationAbsoluteUrl(pathname: string): Promise<string> {
  return new URL(pathname, await requireInstallationPublicOrigin()).toString();
}
