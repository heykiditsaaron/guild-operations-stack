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
    { key: "difficulty", label: "Difficulty", provenance: "declared", value: { kind: "text", value: difficultyLabel(raid.difficulty) } },
    { key: "eligibility", label: "Who can apply", provenance: "declared", value: { kind: "text", value: eligibilityLabel(raid.eligibility) } },
    ...raid.requirements.map((requirement) => ({
      key: "requirement",
      label: requirement.label,
      provenance: "declared" as const,
      value: { kind: "text" as const, value: requirement.value },
    })),
    { key: "signed_up", label: "Signed up", provenance: "derived", value: { kind: "number", value: participation.signedUp } },
    { key: "assigned", label: "Assigned", provenance: "derived", value: { kind: "number", value: roster.assigned } },
    { key: "tanks", label: "Tanks", provenance: "derived", value: { kind: "number", value: roster.tanks } },
    { key: "healers", label: "Healers", provenance: "derived", value: { kind: "number", value: roster.healers } },
    { key: "damage", label: "Damage", provenance: "derived", value: { kind: "number", value: roster.damage } },
    { key: "melee", label: "Melee", provenance: "derived", value: { kind: "number", value: roster.melee } },
    { key: "ranged", label: "Ranged", provenance: "derived", value: { kind: "number", value: roster.ranged } },
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
      async project(procedureReference) {
        const signup = await raidSignup("", procedureReference).catch(() => null);
        if (!signup) return null;
        return {
          title: signup.characterName ?? signup.className,
          attributes: [
            { key: "class", label: "Class", provenance: "declared", value: { kind: "text", value: signup.className } },
            { key: "willing_specs", label: "Willing to play", provenance: "declared", value: { kind: "text", value: signup.willingSpecs.join(", ") } },
            ...(signup.assignmentId === null ? [] : [
              { key: "assignment", label: "Assigned", provenance: "derived" as const, value: { kind: "text" as const, value: [signup.selectedSpec, signup.selectedRole].filter(Boolean).join(" · ") } },
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
