export type ModuleAdministrationDestinationRegistration = {
  label: string;
  destination: string;
  permissionScope: string;
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

  moduleAdministrationDestinations.push({ label, destination, permissionScope });
}

export function authorizedModuleAdministrationDestinations(
  capabilities: readonly string[],
): AdministrationNavigationDestination[] {
  const authorizedScopes = new Set(capabilities);
  return moduleAdministrationDestinations
    .filter((published) => authorizedScopes.has(published.permissionScope))
    .map((published) => ({ label: published.label, href: published.destination }));
}
