import { registerGuildCapabilityDefinitions } from "../../guild-capability-policy.js";
import { RAID_CREATE_CAPABILITY, RAID_MANAGE_CAPABILITY } from "../../guild-permissions.js";

export function registerRaidCapabilityDefinitions(): void {
  registerGuildCapabilityDefinitions([
    { key: RAID_CREATE_CAPABILITY, namespace: "raid", namespaceLabel: "Raid", label: "Create raids", description: "Create new guild raid events.", defaultPermittedRanks: [0, 1, 2] },
    { key: RAID_MANAGE_CAPABILITY, namespace: "raid", namespaceLabel: "Raid", label: "Manage raids", description: "Operate existing raids and their participation.", defaultPermittedRanks: [0, 1, 2, 3] },
  ]);
}
