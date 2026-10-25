import { readFileSync } from "node:fs";

export function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Installation public origin must use http or https");
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) throw new Error("Installation public origin must contain only scheme, host, and optional port");
  return url.origin;
}

/** The canonical public origin is supplied by the host, never inferred from request headers. */
export async function installationPublicOrigin(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const direct = env.PUBLIC_ORIGIN?.trim();
  const file = env.PUBLIC_ORIGIN_FILE?.trim();
  if (direct && file) throw new Error("Configure only one of PUBLIC_ORIGIN or PUBLIC_ORIGIN_FILE");
  const configured = file ? readFileSync(file, "utf8").trim() : direct;
  return configured ? normalizeOrigin(configured) : null;
}

export async function requireInstallationPublicOrigin(): Promise<string> {
  const origin = await installationPublicOrigin();
  if (!origin) throw new Error("Installation public origin is not configured on the host");
  return origin;
}

export async function installationAbsoluteUrl(pathname: string): Promise<string> {
  return new URL(pathname, await requireInstallationPublicOrigin()).toString();
}
