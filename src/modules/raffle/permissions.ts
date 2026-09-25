import { registerGuildCapabilityDefinitions } from "../../core/authority/guild-capability-policy.js";

export const RAFFLE_PERMISSIONS_CAPABILITY = "raffle.permissions";
export const RAFFLE_MODIFY_CAPABILITY = "raffle.modify";
export const RAFFLE_STAGE_CAPABILITY = "raffle.stage";
export const RAFFLE_CLAIMS_CAPABILITY = "raffle.claims";
export const RAFFLE_DRAW_CAPABILITY = "raffle.draw";

export const RAFFLE_CAPABILITY_DEFINITIONS = [
  { key: RAFFLE_PERMISSIONS_CAPABILITY, namespace: "raffle", namespaceLabel: "Raffle", label: "Configure Raffle permissions", description: "Delegate Raffle operational capabilities to guild ranks.", defaultPermittedRanks: [] },
  { key: RAFFLE_MODIFY_CAPABILITY, namespace: "raffle", namespaceLabel: "Raffle", label: "Modify raffles", description: "Establish raffles and change their mutable terms before participation opens.", defaultPermittedRanks: [1, 2] },
  { key: RAFFLE_STAGE_CAPABILITY, namespace: "raffle", namespaceLabel: "Raffle", label: "Stage raffles", description: "Open or close raffle participation and cancel unconcluded raffles.", defaultPermittedRanks: [1, 2] },
  { key: RAFFLE_CLAIMS_CAPABILITY, namespace: "raffle", namespaceLabel: "Raffle", label: "Manage raffle claims", description: "Adjudicate and manage submitted raffle claims.", defaultPermittedRanks: [1, 2] },
  { key: RAFFLE_DRAW_CAPABILITY, namespace: "raffle", namespaceLabel: "Raffle", label: "Draw raffles", description: "Perform raffle winner selection.", defaultPermittedRanks: [1, 2] },
] as const;

export function registerRaffleCapabilityDefinitions(): void {
  registerGuildCapabilityDefinitions(RAFFLE_CAPABILITY_DEFINITIONS);
}
