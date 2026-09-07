import {
  GUILD_DISCORD_MANAGE_CAPABILITY,
  GUILD_REFRESH_CAPABILITY,
  OPERATIONS_INSPECT_CAPABILITY,
  effectiveGuildAuthority,
} from "../guild-permissions.js";
import { raffleAuthorityCanAdminister } from "../modules/raffle/authorization.js";

export type AdministrationAvailability = {
  available: boolean;
  canRefreshGuild: boolean;
  canInspectOperations: boolean;
  canAdministerDiscord: boolean;
  canAdministerRaffle: boolean;
};

const unavailableAdministration: AdministrationAvailability = {
  available: false,
  canRefreshGuild: false,
  canInspectOperations: false,
  canAdministerDiscord: false,
  canAdministerRaffle: false,
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

  return {
    available: canRefreshGuild || canInspectOperations || canAdministerDiscord || canAdministerRaffle,
    canRefreshGuild,
    canInspectOperations,
    canAdministerDiscord,
    canAdministerRaffle,
  };
}
