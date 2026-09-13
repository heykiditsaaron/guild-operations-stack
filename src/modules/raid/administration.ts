import { RAID_CREATE_CAPABILITY } from "../../guild-permissions.js";
import { registerModuleAdministrationDestination } from "../../web/admin-navigation.js";

export function registerRaidAdministrationDestination(): void {
  registerModuleAdministrationDestination({
    label: "Raid",
    destination: "/admin/raid",
    permissionScope: RAID_CREATE_CAPABILITY,
    authorized: (authority) => authority.capabilities.includes(RAID_CREATE_CAPABILITY),
  });
}
