import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export const INSTALLATION_STATE_VERSION = 1;
export type InstallationState = {
  schemaVersion: 1;
  installationId: string;
  createdAt: string;
};

export function administrationDataDirectory(): string {
  return resolve(process.env.GUILD_OPERATIONS_ADMIN_DATA_DIR || "/var/lib/guild-operations-administration");
}

export function validateInstallationState(value: unknown): InstallationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid installation state");
  const state = value as Record<string, unknown>;
  if (state.schemaVersion !== INSTALLATION_STATE_VERSION) throw new Error("Unsupported installation state version");
  if (typeof state.installationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(state.installationId)) throw new Error("Invalid installation ID");
  if (typeof state.createdAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(state.createdAt) || Number.isNaN(Date.parse(state.createdAt))) throw new Error("Invalid installation creation time");
  if (Object.keys(state).sort().join(",") !== "createdAt,installationId,schemaVersion") throw new Error("Unexpected installation state fields");
  return state as InstallationState;
}

export async function readInstallationState(directory = administrationDataDirectory()): Promise<InstallationState | null> {
  try {
    return validateInstallationState(JSON.parse(await readFile(join(directory, "installation-state.json"), "utf8")));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

/** Initialization is explicit: starting the administration service never creates installation identity. */
export async function initializeInstallationState(directory = administrationDataDirectory()): Promise<InstallationState> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const existing = await readInstallationState(directory);
  if (existing) return existing;
  const state: InstallationState = { schemaVersion: 1, installationId: randomUUID(), createdAt: new Date().toISOString() };
  const destination = join(directory, "installation-state.json");
  const temporary = join(dirname(destination), `.installation-state-${randomUUID()}.tmp`);
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(state, null, 2) + "\n");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    // A hard link fails if another initializer has already published state.
    const { link } = await import("node:fs/promises");
    await link(temporary, destination);
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) throw error;
  } finally {
    await rm(temporary, { force: true });
  }
  const published = await readInstallationState(directory);
  if (!published) throw new Error("Installation state initialization failed");
  return published;
}
