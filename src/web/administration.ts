import {
  GUILD_REFRESH_SCHEDULE_CONFIGURE_CAPABILITY,
  MODULES_CONFIGURE_CAPABILITY,
  RAID_PERMISSIONS_CAPABILITY,
  effectiveGuildAuthority,
} from "../guild-permissions.js";
import { DISCORD_ADMIN_CAPABILITY } from "../modules/discord/authorization.js";

export type AdministrationAvailability = {
  available: boolean;
  canConfigureModules: boolean;
  canConfigurePermissions: boolean;
  canConfigureDiscord: boolean;
  canConfigureGuildRefreshSchedule: boolean;
};

const unavailableAdministration: AdministrationAvailability = {
  available: false,
  canConfigureModules: false,
  canConfigurePermissions: false,
  canConfigureDiscord: false,
  canConfigureGuildRefreshSchedule: false,
};

export async function administrationAvailabilityForGuildie(
  guildieId: string,
): Promise<AdministrationAvailability> {
  const authority = await effectiveGuildAuthority(guildieId);
  if (!authority) return unavailableAdministration;

  const canConfigureModules = authority.operator || authority.capabilities.includes(MODULES_CONFIGURE_CAPABILITY);
  const canConfigurePermissions = authority.operator || authority.capabilities.includes(RAID_PERMISSIONS_CAPABILITY);
  const canConfigureDiscord = authority.capabilities.includes(DISCORD_ADMIN_CAPABILITY);
  const canConfigureGuildRefreshSchedule = authority.capabilities.includes(GUILD_REFRESH_SCHEDULE_CONFIGURE_CAPABILITY);
  const available = canConfigureModules
    || canConfigurePermissions
    || canConfigureDiscord
    || canConfigureGuildRefreshSchedule;

  return {
    available,
    canConfigureModules,
    canConfigurePermissions,
    canConfigureDiscord,
    canConfigureGuildRefreshSchedule,
  };
}
