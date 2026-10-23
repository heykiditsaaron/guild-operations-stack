import { initializeInstallationState, readInstallationState, type InstallationState } from "./state.js";

export type AdministrationStatus = { status: "ready"; initialized: boolean; installation: InstallationState | null };

export async function administrationStatus(directory?: string): Promise<AdministrationStatus> {
  const installation = await readInstallationState(directory);
  return { status: "ready", initialized: installation !== null, installation };
}

export async function initializeAdministration(directory?: string): Promise<InstallationState> {
  return initializeInstallationState(directory);
}
