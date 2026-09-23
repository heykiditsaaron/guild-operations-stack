import {
  GUILD_REFRESH_SCHEDULE_CONFIGURE_CAPABILITY,
  GUILD_PRESENTATION_CONFIGURE_CAPABILITY,
  MODULES_CONFIGURE_CAPABILITY,
  THEME_CONFIGURE_CAPABILITY,
  effectiveGuildAuthority,
} from "../core/authority/guild-permissions.js";
import { canAdministerGuildPermissions } from "../core/authority/guild-capability-policy.js";
import { DISCORD_ADMIN_CAPABILITY } from "../plugins/discord/authorization.js";

export type AdministrationAvailability = {
  available: boolean;
  canConfigureModules: boolean;
  canConfigurePermissions: boolean;
  canConfigureTheme: boolean;
  canConfigureGuildPresentation: boolean;
  canConfigureDiscord: boolean;
  canConfigureGuildRefreshSchedule: boolean;
};

const unavailableAdministration: AdministrationAvailability = {
  available: false,
  canConfigureModules: false,
  canConfigurePermissions: false,
  canConfigureTheme: false,
  canConfigureGuildPresentation: false,
  canConfigureDiscord: false,
  canConfigureGuildRefreshSchedule: false,
};

export async function administrationAvailabilityForGuildie(
  guildieId: string,
): Promise<AdministrationAvailability> {
  const authority = await effectiveGuildAuthority(guildieId);
  if (!authority) return unavailableAdministration;

  const canConfigureModules = authority.operator || authority.capabilities.includes(MODULES_CONFIGURE_CAPABILITY);
  const canConfigurePermissions = await canAdministerGuildPermissions(guildieId);
  const canConfigureTheme = authority.operator || authority.rankIndex === 0 || authority.capabilities.includes(THEME_CONFIGURE_CAPABILITY);
  const canConfigureGuildPresentation = authority.operator || authority.rankIndex === 0 || authority.capabilities.includes(GUILD_PRESENTATION_CONFIGURE_CAPABILITY);
  const canConfigureDiscord = authority.capabilities.includes(DISCORD_ADMIN_CAPABILITY);
  const canConfigureGuildRefreshSchedule = authority.capabilities.includes(GUILD_REFRESH_SCHEDULE_CONFIGURE_CAPABILITY);
  const available = canConfigureModules
    || canConfigurePermissions
    || canConfigureTheme
    || canConfigureGuildPresentation
    || canConfigureDiscord
    || canConfigureGuildRefreshSchedule;

  return {
    available,
    canConfigureModules,
    canConfigurePermissions,
    canConfigureTheme,
    canConfigureGuildPresentation,
    canConfigureDiscord,
    canConfigureGuildRefreshSchedule,
  };
}
