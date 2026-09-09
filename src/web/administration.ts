import {
  GUILD_REFRESH_CAPABILITY,
  OPERATIONS_INSPECT_CAPABILITY,
  effectiveGuildAuthority,
} from "../guild-permissions.js";
import {
  authorizedModuleAdministrationDestinations,
  type AdministrationNavigationDestination,
} from "./admin-navigation.js";

export type AdministrationAvailability = {
  available: boolean;
  canRefreshGuild: boolean;
  canInspectOperations: boolean;
  navigationDestinations: AdministrationNavigationDestination[];
};

const unavailableAdministration: AdministrationAvailability = {
  available: false,
  canRefreshGuild: false,
  canInspectOperations: false,
  navigationDestinations: [],
};

export async function administrationAvailabilityForGuildie(
  guildieId: string,
): Promise<AdministrationAvailability> {
  const authority = await effectiveGuildAuthority(guildieId);
  if (!authority) return unavailableAdministration;

  const canRefreshGuild = authority.capabilities.includes(GUILD_REFRESH_CAPABILITY);
  const canInspectOperations = authority.capabilities.includes(OPERATIONS_INSPECT_CAPABILITY);
  const moduleDestinations = authorizedModuleAdministrationDestinations(authority);
  const available = canRefreshGuild || canInspectOperations || moduleDestinations.length > 0;

  return {
    available,
    canRefreshGuild,
    canInspectOperations,
    navigationDestinations: available
      ? [{ label: "Guild Operations", href: "/admin" }, ...moduleDestinations]
      : [],
  };
}
