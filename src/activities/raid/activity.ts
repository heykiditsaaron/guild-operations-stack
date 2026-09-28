import { guildieHasGuildCapabilityOrOperator } from "../../core/authority/guild-permissions.js";
import {
  registerActivity,
  type ActivityOccurrenceAttribute,
} from "../../core/activity/registry.js";
import {
  raidEventFactsIncludingCancelled,
  raidRosterDiagnostics,
} from "./application.js";
import { raidListingParticipationSummary } from "./listing-view.js";
import { RAID_ASSIGN_CAPABILITY, RAID_CAPABILITY_DEFINITIONS, RAID_MODIFY_CAPABILITY, RAID_STAGE_CAPABILITY } from "./permissions.js";
import type { RaidDifficulty, RaidEligibility } from "./domain.js";
import { raidsForOperation } from "./operation-view.js";
import { raidSignup } from "./participation-view.js";

function difficultyLabel(value: RaidDifficulty): string {
  return value[0].toUpperCase() + value.slice(1);
}

function eligibilityLabel(value: RaidEligibility): string {
  if (value === "guild_character_member") return "Guild Character Member";
  if (value === "guildie") return "Guildie";
  return "Anyone";
}

async function raidOccurrence(raidId: string) {
  const raid = await raidEventFactsIncludingCancelled(raidId);
  if (!raid) return null;

  const [participation, roster] = await Promise.all([
    raidListingParticipationSummary(raidId),
    raidRosterDiagnostics(raidId),
  ]);

  const attributes: ActivityOccurrenceAttribute[] = [
    { kind: "difficulty", label: "Difficulty", provenance: "declared", value: { type: "string", value: difficultyLabel(raid.difficulty) } },
    { kind: "eligibility", label: "Who can apply", provenance: "declared", value: { type: "string", value: eligibilityLabel(raid.eligibility) } },
    ...raid.requirements.map((requirement) => ({
      kind: "requirement",
      label: requirement.label,
      provenance: "declared" as const,
      value: { type: "string" as const, value: requirement.value },
    })),
    { kind: "signed_up", label: "Signed up", provenance: "derived", value: { type: "integer", value: participation.signedUp } },
    { kind: "assigned", label: "Assigned", provenance: "derived", value: { type: "integer", value: roster.assigned } },
    { kind: "tanks", label: "Tanks", provenance: "derived", value: { type: "integer", value: roster.tanks } },
    { kind: "healers", label: "Healers", provenance: "derived", value: { type: "integer", value: roster.healers } },
    { kind: "damage", label: "Damage", provenance: "derived", value: { type: "integer", value: roster.damage } },
    { kind: "melee", label: "Melee", provenance: "derived", value: { type: "integer", value: roster.melee } },
    { kind: "ranged", label: "Ranged", provenance: "derived", value: { type: "integer", value: roster.ranged } },
  ];

  return {
    occursAt: raid.cancelledAtUnix === null
      ? { start: raid.occursAt[0], end: raid.occursAt.length === 2 ? raid.occursAt[1] : null }
      : null,
    title: raid.label,
    description: raid.description,
    phase: raid.cancelledAtUnix === null && raid.concludedAtUnix === null ? "active" as const : "record" as const,
    attributes,
    interactions: raid.cancelledAtUnix !== null || raid.concludedAtUnix !== null
      ? []
      : [
          { kind: "participate" as const, label: "Sign up" },
          { kind: "operate" as const, label: "Manage raid" },
        ],
  };
}

export function registerRaidActivityIntegration(): void {
  registerActivity({
    kind: "raid",
    administration: { capabilities: RAID_CAPABILITY_DEFINITIONS },
    discovery: {
      title: "Raid",
      tagline: "Organized guild raiding and roster participation.",
      destination: "/activities/raid",
    },
    occurrence: {
      resolve: raidOccurrence,
      async list() {
        return (await raidsForOperation())
          .filter((raid) => raid.concludedAtUnix === null)
          .map((raid) => raid.raidId);
      },
    },
    participation: {
      async project(activityId, procedureReference) {
        const signup = await raidSignup(activityId, procedureReference);
        if (!signup) return null;
        return {
          title: signup.characterName ?? signup.className,
          attributes: [
            { kind: "class", label: "Class", provenance: "declared", value: { type: "wow_class", value: signup.className } },
            { kind: "willingness", label: "Willing to play", provenance: "declared", value: signup.willingSpecs.map((spec) => ({ type: "wow_spec" as const, value: spec })) },
            ...(signup.assignmentId === null ? [] : [
              ...(signup.selectedSpec ? [{ kind: "assigned_spec", label: "Assigned spec", provenance: "derived" as const, value: { type: "wow_spec" as const, value: signup.selectedSpec } }] : []),
              ...(signup.selectedRole ? [{ kind: "assigned_role", label: "Assigned role", provenance: "derived" as const, value: { type: "wow_role" as const, value: signup.selectedRole } }] : []),
            ]),
          ],
        };
      },
    },
    interaction: {
      async availableTo(kind, _activityId, guildieId) {
        if (kind !== "operate") return true;
        if (!guildieId) return false;
        const permitted = await Promise.all([
          RAID_MODIFY_CAPABILITY,
          RAID_STAGE_CAPABILITY,
          RAID_ASSIGN_CAPABILITY,
        ].map((capability) => guildieHasGuildCapabilityOrOperator(guildieId, capability)));
        return permitted.some(Boolean);
      },
      destination(kind, activityId) {
        const id = encodeURIComponent(activityId);
        if (kind === "participate") return `/activities/raid/${id}/participation`;
        if (kind === "operate") return `/activities/raid/${id}/manage`;
        return null;
      },
    },
  });
}
