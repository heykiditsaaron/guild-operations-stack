import { specHasTrait, traitsForSpec, type WowTrait } from "../../wow-traits/registry.js";

export type RaidEligibility = "guild_character_member" | "guildie" | "anyone";
export type RaidRole = "tank" | "healer" | "damage";

export type RaidApplicantAnchor =
  | { kind: "guildie"; value: string }
  | { kind: "discord_user"; value: string };

export type RaidCharacterReference = {
  region: string;
  realmId: string;
  characterId: string;
};

export type RaidParticipationKey =
  | { character: RaidCharacterReference }
  | { declaredClass: string };

export type CreateRaidInput = {
  label: string;
  description?: string | null;
  occursAt: readonly [number] | readonly [number, number];
  tags?: readonly string[];
  eligibility: RaidEligibility;
  raidSize: number;
};

export type SubmitRaidParticipationRowInput = {
  raidId: string;
  applicantAnchor: RaidApplicantAnchor;
  participationKey: RaidParticipationKey;
  willingSpecs: readonly string[];
  willingRoles: readonly RaidRole[];
};

export type AssignRaidParticipationInput = {
  raidId: string;
  signupRowId: string;
  slotIndex: number;
  selectedSpec: string;
  selectedRole: RaidRole;
};

export function normalizedStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function validateCreateRaidInput(input: CreateRaidInput): void {
  if (!input.label.trim()) throw new Error("Raid label is required");
  if (input.occursAt.length !== 1 && input.occursAt.length !== 2) throw new Error("Raid occurrence must be an instant or range");
  if (!input.occursAt.every((value) => Number.isSafeInteger(value) && value > 0)) throw new Error("Raid occurrence must use positive Unix timestamps");
  if (input.occursAt.length === 2 && input.occursAt[1] < input.occursAt[0]) throw new Error("Raid occurrence end cannot precede start");
  if (!Number.isInteger(input.raidSize) || input.raidSize < 1 || input.raidSize > 40) throw new Error("Raid size must be between 1 and 40");
}

export function validateParticipationWillingness(
  className: string,
  specs: readonly string[],
  roles: readonly RaidRole[],
): void {
  const normalizedSpecs = normalizedStrings(specs);
  const normalizedRoles = [...new Set(roles)];
  if (!normalizedSpecs.length) throw new Error("At least one willing specialization is required");
  if (!normalizedRoles.length) throw new Error("At least one willing role is required");

  for (const spec of normalizedSpecs) {
    const traits = traitsForSpec(className, spec);
    if (!traits.length) throw new Error(`Unknown class/specialization combination: ${className} / ${spec}`);
  }

  const roleTrait: Record<RaidRole, WowTrait> = {
    tank: "role.tank",
    healer: "role.healer",
    damage: "role.damage",
  };

  for (const role of normalizedRoles) {
    if (!normalizedSpecs.some((spec) => specHasTrait(className, spec, roleTrait[role]))) {
      throw new Error(`Offered role ${role} is not supported by the offered specializations`);
    }
  }
}

export function validateSelectedConfiguration(
  className: string,
  willingSpecs: readonly string[],
  willingRoles: readonly RaidRole[],
  selectedSpec: string,
  selectedRole: RaidRole,
): void {
  if (!willingSpecs.includes(selectedSpec)) throw new Error("Selected specialization was not offered by the applicant");
  if (!willingRoles.includes(selectedRole)) throw new Error("Selected role was not offered by the applicant");
  validateParticipationWillingness(className, [selectedSpec], [selectedRole]);
}
