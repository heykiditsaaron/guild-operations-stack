import { registerGuildCapabilityDefinitions } from "../../core/authority/guild-capability-policy.js";
import {
  RAID_ASSIGN_CAPABILITY,
  RAID_MODIFY_CAPABILITY,
  RAID_PERMISSIONS_CAPABILITY,
  RAID_STAGE_CAPABILITY,
} from "../../core/authority/guild-permissions.js";

export function registerRaidCapabilityDefinitions(): void {
  registerGuildCapabilityDefinitions([
    { key: RAID_PERMISSIONS_CAPABILITY, namespace: "raid", namespaceLabel: "Raid", label: "Configure Raid permissions", description: "Delegate Raid operational capabilities to guild ranks.", defaultPermittedRanks: [] },
    { key: RAID_MODIFY_CAPABILITY, namespace: "raid", namespaceLabel: "Raid", label: "Modify raids", description: "Create raids and change their mutable persisted definition.", defaultPermittedRanks: [1, 2] },
    { key: RAID_STAGE_CAPABILITY, namespace: "raid", namespaceLabel: "Raid", label: "Cancel raids", description: "Destructively cancel an upcoming raid and remove its participation and assignments.", defaultPermittedRanks: [1, 2, 3] },
    { key: RAID_ASSIGN_CAPABILITY, namespace: "raid", namespaceLabel: "Raid", label: "Assign raid participation", description: "Assign and unassign participants in a raid roster.", defaultPermittedRanks: [1, 2, 3] },
  ]);
}
