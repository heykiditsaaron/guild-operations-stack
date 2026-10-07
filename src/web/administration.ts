import {
  GUILD_REFRESH_SCHEDULE_CONFIGURE_CAPABILITY,
  GUILD_PRESENTATION_CONFIGURE_CAPABILITY,
  MODULES_CONFIGURE_CAPABILITY,
  DISCORD_CONFIGURE_CAPABILITY,
  THEME_CONFIGURE_CAPABILITY,
  effectiveGuildAuthority,
} from "../core/authority/guild-permissions.js";
import { canAdministerGuildPermissions } from "../core/authority/guild-capability-policy.js";

export type AdministrationAvailability = {
  available: boolean;
  canConfigureModules: boolean;
  canConfigureDiscord: boolean;
  canConfigurePermissions: boolean;
  canConfigureTheme: boolean;
  canConfigureGuildPresentation: boolean;
  canConfigureGuildRefreshSchedule: boolean;
};

const unavailableAdministration: AdministrationAvailability = {
  available: false,
  canConfigureModules: false,
  canConfigureDiscord: false,
  canConfigurePermissions: false,
  canConfigureTheme: false,
  canConfigureGuildPresentation: false,
  canConfigureGuildRefreshSchedule: false,
};

export async function administrationAvailabilityForIdentity(
  identityId: string,
): Promise<AdministrationAvailability> {
  const authority = await effectiveGuildAuthority(identityId);
  if (!authority) return unavailableAdministration;

  const canConfigureModules = authority.developmentGuildMasterAuthority || authority.capabilities.includes(MODULES_CONFIGURE_CAPABILITY);
  const canConfigureDiscord = authority.developmentGuildMasterAuthority || authority.rankIndex === 0 || authority.capabilities.includes(DISCORD_CONFIGURE_CAPABILITY);
  const canConfigurePermissions = await canAdministerGuildPermissions(identityId);
  const canConfigureTheme = authority.developmentGuildMasterAuthority || authority.rankIndex === 0 || authority.capabilities.includes(THEME_CONFIGURE_CAPABILITY);
  const canConfigureGuildPresentation = authority.developmentGuildMasterAuthority || authority.rankIndex === 0 || authority.capabilities.includes(GUILD_PRESENTATION_CONFIGURE_CAPABILITY);
  const canConfigureGuildRefreshSchedule = authority.capabilities.includes(GUILD_REFRESH_SCHEDULE_CONFIGURE_CAPABILITY);
  const available = canConfigureDiscord
    || canConfigureModules
    || canConfigurePermissions
    || canConfigureTheme
    || canConfigureGuildPresentation
    || canConfigureGuildRefreshSchedule;

  return {
    available,
    canConfigureModules,
    canConfigureDiscord,
    canConfigurePermissions,
    canConfigureTheme,
    canConfigureGuildPresentation,
    canConfigureGuildRefreshSchedule,
  };
}
