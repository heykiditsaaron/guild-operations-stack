import {
  GUILD_DISCORD_MANAGE_CAPABILITY,
  GUILD_REFRESH_CAPABILITY,
  OPERATIONS_INSPECT_CAPABILITY,
  effectiveGuildAuthority,
} from "../guild-permissions.js";
import { raffleAuthorityCanAdminister } from "../modules/raffle/authorization.js";
import {
  authorizedModuleAdministrationDestinations,
  type AdministrationNavigationDestination,
} from "./admin-navigation.js";

export type AdministrationAvailability = {
  available: boolean;
  canRefreshGuild: boolean;
  canInspectOperations: boolean;
  canAdministerDiscord: boolean;
  canAdministerRaffle: boolean;
  navigationDestinations: AdministrationNavigationDestination[];
};

const unavailableAdministration: AdministrationAvailability = {
  available: false,
  canRefreshGuild: false,
  canInspectOperations: false,
  canAdministerDiscord: false,
  canAdministerRaffle: false,
  navigationDestinations: [],
};

export async function administrationAvailabilityForGuildie(
  guildieId: string,
): Promise<AdministrationAvailability> {
  const authority = await effectiveGuildAuthority(guildieId);
  if (!authority) return unavailableAdministration;

  const canRefreshGuild = authority.capabilities.includes(GUILD_REFRESH_CAPABILITY);
  const canInspectOperations = authority.capabilities.includes(OPERATIONS_INSPECT_CAPABILITY);
  const canAdministerDiscord = authority.capabilities.includes(GUILD_DISCORD_MANAGE_CAPABILITY);
  const canAdministerRaffle = raffleAuthorityCanAdminister(authority);
  const moduleDestinations = authorizedModuleAdministrationDestinations(authority);
  const available = canRefreshGuild
    || canInspectOperations
    || canAdministerDiscord
    || canAdministerRaffle
    || moduleDestinations.length > 0;

  return {
    available,
    canRefreshGuild,
    canInspectOperations,
    canAdministerDiscord,
    canAdministerRaffle,
    navigationDestinations: available
      ? [{ label: "Guild Operations", href: "/admin" }, ...moduleDestinations]
      : [],
  };
}
