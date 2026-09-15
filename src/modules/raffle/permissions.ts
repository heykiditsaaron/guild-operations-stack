import { registerGuildCapabilityDefinitions } from "../../guild-capability-policy.js";
import {
  RAFFLE_CLAIMS_CAPABILITY,
  RAFFLE_DRAW_CAPABILITY,
  RAFFLE_MODIFY_CAPABILITY,
  RAFFLE_PERMISSIONS_CAPABILITY,
  RAFFLE_STAGE_CAPABILITY,
} from "../../guild-permissions.js";

export function registerRaffleCapabilityDefinitions(): void {
  registerGuildCapabilityDefinitions([
    { key: RAFFLE_PERMISSIONS_CAPABILITY, namespace: "raffle", namespaceLabel: "Raffle", label: "Configure Raffle permissions", description: "Delegate Raffle operational capabilities to guild ranks.", defaultPermittedRanks: [] },
    { key: RAFFLE_MODIFY_CAPABILITY, namespace: "raffle", namespaceLabel: "Raffle", label: "Modify raffles", description: "Create raffle rounds and change their mutable persisted definition.", defaultPermittedRanks: [1, 2] },
    { key: RAFFLE_STAGE_CAPABILITY, namespace: "raffle", namespaceLabel: "Raffle", label: "Stage raffles", description: "Move raffle rounds through their module-defined operational stages.", defaultPermittedRanks: [1, 2] },
    { key: RAFFLE_CLAIMS_CAPABILITY, namespace: "raffle", namespaceLabel: "Raffle", label: "Manage raffle claims", description: "Adjudicate and manage submitted raffle claims.", defaultPermittedRanks: [1, 2] },
    { key: RAFFLE_DRAW_CAPABILITY, namespace: "raffle", namespaceLabel: "Raffle", label: "Draw raffles", description: "Perform raffle winner selection.", defaultPermittedRanks: [1, 2] },
  ]);
}
