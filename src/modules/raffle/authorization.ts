import {
  RAFFLE_CLAIMS_CAPABILITY,
  RAFFLE_DRAW_CAPABILITY,
  RAFFLE_MODIFY_CAPABILITY,
  RAFFLE_STAGE_CAPABILITY,
  guildieHasGuildCapability,
  type GuildCapability,
} from "../../guild-permissions.js";

const RAFFLE_OPERATION_CAPABILITIES: readonly GuildCapability[] = [
  RAFFLE_MODIFY_CAPABILITY,
  RAFFLE_STAGE_CAPABILITY,
  RAFFLE_CLAIMS_CAPABILITY,
  RAFFLE_DRAW_CAPABILITY,
];

/**
 * Aggregate visibility check for presenting Raffle's operational surface.
 * This is not an authorization boundary: consequential operations enforce
 * their precise capability in the Raffle application contract.
 */
export async function raffleGuildieCanOperate(guildieId: string): Promise<boolean> {
  const checks = await Promise.all(
    RAFFLE_OPERATION_CAPABILITIES.map((capability) => guildieHasGuildCapability(guildieId, capability)),
  );
  return checks.some(Boolean);
}
