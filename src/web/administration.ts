import {
  GUILD_REFRESH_CAPABILITY,
  MODULES_CONFIGURE_CAPABILITY,
  OPERATIONS_INSPECT_CAPABILITY,
  RAID_PERMISSIONS_CAPABILITY,
  effectiveGuildAuthority,
} from "../guild-permissions.js";
import { DISCORD_ADMIN_CAPABILITY } from "../modules/discord/authorization.js";

export type AdministrationAvailability = {
  available: boolean;
  canConfigureModules: boolean;
  canConfigurePermissions: boolean;
  canConfigureDiscord: boolean;
  canRefreshGuild: boolean;
  canInspectOperations: boolean;
};

const unavailableAdministration: AdministrationAvailability = {
  available: false,
  canConfigureModules: false,
  canConfigurePermissions: false,
  canConfigureDiscord: false,
  canRefreshGuild: false,
  canInspectOperations: false,
};

export async function administrationAvailabilityForGuildie(
  guildieId: string,
): Promise<AdministrationAvailability> {
  const authority = await effectiveGuildAuthority(guildieId);
  if (!authority) return unavailableAdministration;

  const canConfigureModules = authority.operator || authority.capabilities.includes(MODULES_CONFIGURE_CAPABILITY);
  const canConfigurePermissions = authority.operator || authority.capabilities.includes(RAID_PERMISSIONS_CAPABILITY);
  const canConfigureDiscord = authority.capabilities.includes(DISCORD_ADMIN_CAPABILITY);
  const canRefreshGuild = authority.capabilities.includes(GUILD_REFRESH_CAPABILITY);
  const canInspectOperations = authority.capabilities.includes(OPERATIONS_INSPECT_CAPABILITY);
  const available = canConfigureModules
    || canConfigurePermissions
    || canConfigureDiscord
    || canRefreshGuild
    || canInspectOperations;

  return {
    available,
    canConfigureModules,
    canConfigurePermissions,
    canConfigureDiscord,
    canRefreshGuild,
    canInspectOperations,
  };
}
