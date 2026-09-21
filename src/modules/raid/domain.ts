import { specHasTrait, traitsForSpec, type WowTrait } from "../../wow-traits/registry.js";

export const RAID_LABEL_MAX_LENGTH = 80;
export const RAID_DESCRIPTION_MAX_LENGTH = 1400;

export type RaidEligibility = "guild_character_member" | "guildie" | "anyone";
export type RaidDifficulty = "normal" | "heroic" | "mythic";
export type RaidRole = "tank" | "healer" | "damage";
export type RaidOccurrence = readonly [number] | readonly [number, number];

export type RaidRequirement = {
  label: string;
  value: string;
};

export type RaidApplicantAnchor =
  | { kind: "guildie"; value: string }
  | { kind: "external"; value: string };

export type RaidCharacterReference = {
  region: string;
  realmId: string;
  characterId: string;
};

export type RaidParticipationKey =
  | { character: RaidCharacterReference }
  | { declaredClass: string };

export type EstablishRaidInput = {
  label: string;
  description?: string | null;
  occursAt: RaidOccurrence;
  tags?: readonly string[];
  eligibility: RaidEligibility;
  difficulty: RaidDifficulty;
  requirements?: readonly RaidRequirement[];
};

export type ModifyRaidInput = {
  label?: string;
  description?: string | null;
  occursAt?: RaidOccurrence;
  tags?: readonly string[];
  difficulty?: RaidDifficulty;
  requirements?: readonly RaidRequirement[];
};

export type EstablishRaidSignupInput = {
  raidId: string;
  applicantAnchor: RaidApplicantAnchor;
  participationKey: RaidParticipationKey;
  willingSpecs: readonly string[];
};

export type RevokeRaidSignupInput = {
  raidId: string;
  signupRowId: string;
  applicantAnchor: RaidApplicantAnchor;
};

export type EstablishRaidAssignmentInput = {
  raidId: string;
  signupRowId: string;
  selectedSpec: string;
  selectedRole: RaidRole;
};

export type ModifyRaidAssignmentInput = EstablishRaidAssignmentInput;

export type DenyRaidSignupInput = {
  raidId: string;
  signupRowId: string;
};

export function normalizedStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function normalizedRaidRequirements(values: readonly RaidRequirement[]): RaidRequirement[] {
  return values.map((requirement) => ({
    label: requirement.label.trim(),
    value: requirement.value.trim(),
  }));
}

function validateOccurrence(occursAt: RaidOccurrence): void {
  if (occursAt.length !== 1 && occursAt.length !== 2) throw new Error("Raid occurrence must be an instant or range");
  if (!occursAt.every((value) => Number.isSafeInteger(value) && value > 0)) throw new Error("Raid occurrence must use positive Unix timestamps");
  if (occursAt.length === 2 && occursAt[1] < occursAt[0]) throw new Error("Raid occurrence end cannot precede start");
}

function validateRequirements(requirements: readonly RaidRequirement[]): void {
  for (const requirement of requirements) {
    if (!requirement.label.trim()) throw new Error("Raid requirement label is required");
    if (!requirement.value.trim()) throw new Error("Raid requirement value is required");
  }
}

function validateAuthoredContent(label: string, description?: string | null): void {
  if (!label.trim()) throw new Error("Raid label is required");
  if (label.length > RAID_LABEL_MAX_LENGTH) throw new Error(`Raid label cannot exceed ${RAID_LABEL_MAX_LENGTH} characters`);
  if (description !== undefined && description !== null && description.length > RAID_DESCRIPTION_MAX_LENGTH) {
    throw new Error(`Raid description cannot exceed ${RAID_DESCRIPTION_MAX_LENGTH} characters`);
  }
}

export function validateEstablishRaidInput(input: EstablishRaidInput): void {
  validateAuthoredContent(input.label, input.description);
  validateOccurrence(input.occursAt);
  validateRequirements(input.requirements ?? []);
}

export function validateModifyRaidInput(input: ModifyRaidInput): void {
  if (!Object.keys(input).length) throw new Error("At least one Raid definition change is required");
  if (input.label !== undefined) validateAuthoredContent(input.label, input.description);
  else if (input.description !== undefined && input.description !== null && input.description.length > RAID_DESCRIPTION_MAX_LENGTH) {
    throw new Error(`Raid description cannot exceed ${RAID_DESCRIPTION_MAX_LENGTH} characters`);
  }
  if (input.occursAt !== undefined) validateOccurrence(input.occursAt);
  if (input.requirements !== undefined) validateRequirements(input.requirements);
}

export function rolesForParticipationSpecs(className: string, specs: readonly string[]): RaidRole[] {
  const normalizedSpecs = normalizedStrings(specs);
  if (!normalizedSpecs.length) throw new Error("At least one willing specialization is required");

  for (const spec of normalizedSpecs) {
    const traits = traitsForSpec(className, spec);
    if (!traits.length) throw new Error(`Unknown class/specialization combination: ${className} / ${spec}`);
  }

  const roleTrait: Record<RaidRole, WowTrait> = {
    tank: "role.tank",
    healer: "role.healer",
    damage: "role.damage",
  };
  return (["tank", "healer", "damage"] as const).filter((role) =>
    normalizedSpecs.some((spec) => specHasTrait(className, spec, roleTrait[role])),
  );
}

export function validateParticipationWillingness(className: string, specs: readonly string[]): void {
  rolesForParticipationSpecs(className, specs);
}

export function validateSelectedConfiguration(
  className: string,
  willingSpecs: readonly string[],
  selectedSpec: string,
  selectedRole: RaidRole,
): void {
  if (!willingSpecs.includes(selectedSpec)) throw new Error("Selected specialization was not offered by the applicant");
  const selectedRoles = rolesForParticipationSpecs(className, [selectedSpec]);
  if (!selectedRoles.includes(selectedRole)) throw new Error("Selected role is not supported by the selected specialization");
}
