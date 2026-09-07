import type { EffectiveGuildAuthority } from "../guild-permissions.js";

export type ModuleAdministrationDestinationRegistration = {
  label: string;
  destination: string;
  permissionScope: string;
  authorized: (authority: EffectiveGuildAuthority) => boolean;
};

export type AdministrationNavigationDestination = {
  label: string;
  href: string;
};

const moduleAdministrationDestinations: ModuleAdministrationDestinationRegistration[] = [];

export function registerModuleAdministrationDestination(
  registration: ModuleAdministrationDestinationRegistration,
): void {
  const label = registration.label.trim();
  const destination = registration.destination.trim();
  const permissionScope = registration.permissionScope.trim();

  if (!label) throw new Error("Module administration destination label is required");
  if (!destination.startsWith("/admin/") || destination === "/admin/") {
    throw new Error("Module administration destination must live below /admin");
  }
  if (!permissionScope) throw new Error("Module administration permission scope is required");

  if (moduleAdministrationDestinations.some((published) => published.destination === destination)) {
    throw new Error(`Duplicate module administration destination: ${destination}`);
  }
  if (moduleAdministrationDestinations.some((published) => published.permissionScope === permissionScope)) {
    throw new Error(`Duplicate module administration permission scope: ${permissionScope}`);
  }

  moduleAdministrationDestinations.push({
    label,
    destination,
    permissionScope,
    authorized: registration.authorized,
  });
}

export function authorizedModuleAdministrationDestinations(
  authority: EffectiveGuildAuthority,
): AdministrationNavigationDestination[] {
  return moduleAdministrationDestinations
    .filter((published) => published.authorized(authority))
    .map((published) => ({ label: published.label, href: published.destination }));
}
