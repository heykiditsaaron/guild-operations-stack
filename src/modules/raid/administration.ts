import {
  RAID_CREATE_CAPABILITY,
  RAID_MANAGE_CAPABILITY,
  RAID_PERMISSIONS_CAPABILITY,
} from "../../guild-permissions.js";
import { registerModuleAdministrationDestination } from "../../web/admin-navigation.js";

export function registerRaidAdministrationDestination(): void {
  registerModuleAdministrationDestination({
    label: "Raid",
    destination: "/admin/raid",
    permissionScope: RAID_MANAGE_CAPABILITY,
    authorized: (authority) => authority.operator
      || authority.capabilities.includes(RAID_CREATE_CAPABILITY)
      || authority.capabilities.includes(RAID_MANAGE_CAPABILITY)
      || authority.capabilities.includes(RAID_PERMISSIONS_CAPABILITY),
  });
}
