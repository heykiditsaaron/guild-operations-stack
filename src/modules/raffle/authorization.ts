import {
  RAFFLE_CLAIMS_CAPABILITY,
  RAFFLE_DRAW_CAPABILITY,
  RAFFLE_MODIFY_CAPABILITY,
  RAFFLE_PERMISSIONS_CAPABILITY,
  RAFFLE_STAGE_CAPABILITY,
  guildieHasGuildCapability,
  requireGuildCapabilityOrOperator,
  type GuildCapability,
} from "../../guild-permissions.js";

const RAFFLE_ADMIN_CAPABILITIES: readonly GuildCapability[] = [
  RAFFLE_PERMISSIONS_CAPABILITY,
  RAFFLE_MODIFY_CAPABILITY,
  RAFFLE_STAGE_CAPABILITY,
  RAFFLE_CLAIMS_CAPABILITY,
  RAFFLE_DRAW_CAPABILITY,
];

export async function raffleGuildieCanAdminister(guildieId: string): Promise<boolean> {
  const checks = await Promise.all(RAFFLE_ADMIN_CAPABILITIES.map((capability) => guildieHasGuildCapability(guildieId, capability)));
  return checks.some(Boolean);
}

// Compatibility gate for legacy Raffle domain/route surfaces. Precise operation
// authority is enforced by the application contract before these paths execute.
export async function requireRaffleAdmin(guildieId: string): Promise<void> {
  if (await raffleGuildieCanAdminister(guildieId)) return;
  await requireGuildCapabilityOrOperator(guildieId, RAFFLE_MODIFY_CAPABILITY);
}
