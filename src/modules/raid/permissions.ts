
export const RAID_PERMISSIONS_CAPABILITY = "raid.permissions";
export const RAID_MODIFY_CAPABILITY = "raid.modify";
export const RAID_STAGE_CAPABILITY = "raid.stage";
export const RAID_ASSIGN_CAPABILITY = "raid.assign";

export const RAID_CAPABILITY_DEFINITIONS = [
  { key: RAID_PERMISSIONS_CAPABILITY, namespace: "raid", namespaceLabel: "Raid", label: "Configure Raid permissions", description: "Delegate Raid operational capabilities to guild ranks.", defaultPermittedRanks: [] },
  { key: RAID_MODIFY_CAPABILITY, namespace: "raid", namespaceLabel: "Raid", label: "Modify raids", description: "Create raids and change their mutable persisted definition.", defaultPermittedRanks: [1, 2] },
  { key: RAID_STAGE_CAPABILITY, namespace: "raid", namespaceLabel: "Raid", label: "Cancel raids", description: "Destructively cancel an upcoming raid and remove its participation and assignments.", defaultPermittedRanks: [1, 2, 3] },
  { key: RAID_ASSIGN_CAPABILITY, namespace: "raid", namespaceLabel: "Raid", label: "Assign raid participation", description: "Assign and unassign participants in a raid roster.", defaultPermittedRanks: [1, 2, 3] },
] as const;

export function registerRaidCapabilityDefinitions(): void {
  registerGuildCapabilityDefinitions(RAID_CAPABILITY_DEFINITIONS);
}
