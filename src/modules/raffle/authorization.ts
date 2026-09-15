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

const RAFFLE_OPERATION_CAPABILITIES: readonly GuildCapability[] = [
  RAFFLE_MODIFY_CAPABILITY,
  RAFFLE_STAGE_CAPABILITY,
  RAFFLE_CLAIMS_CAPABILITY,
  RAFFLE_DRAW_CAPABILITY,
];

const RAFFLE_ADMIN_CAPABILITIES: readonly GuildCapability[] = [
  RAFFLE_PERMISSIONS_CAPABILITY,
  ...RAFFLE_OPERATION_CAPABILITIES,
];

async function guildieHasAnyRaffleCapability(guildieId: string, capabilities: readonly GuildCapability[]): Promise<boolean> {
  const checks = await Promise.all(capabilities.map((capability) => guildieHasGuildCapability(guildieId, capability)));
  return checks.some(Boolean);
}

export async function raffleGuildieCanOperate(guildieId: string): Promise<boolean> {
  return guildieHasAnyRaffleCapability(guildieId, RAFFLE_OPERATION_CAPABILITIES);
}

export async function raffleGuildieCanAdminister(guildieId: string): Promise<boolean> {
  return guildieHasAnyRaffleCapability(guildieId, RAFFLE_ADMIN_CAPABILITIES);
}

export async function requireRaffleOperation(guildieId: string): Promise<void> {
  if (await raffleGuildieCanOperate(guildieId)) return;
  await requireGuildCapabilityOrOperator(guildieId, RAFFLE_MODIFY_CAPABILITY);
}

// Compatibility gate for legacy Raffle domain surfaces. Precise mutation
// authority is enforced by the application contract before these paths execute.
export async function requireRaffleAdmin(guildieId: string): Promise<void> {
  await requireRaffleOperation(guildieId);
}
