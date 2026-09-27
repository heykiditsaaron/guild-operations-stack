import {
  registerActivity,
  type ActivityOccurrenceAttribute,
  type ActivityTemporalCoordinate,
} from "../../core/activity/registry.js";
import {
  raidEventFactsIncludingCancelled,
  raidRosterDiagnostics,
} from "./application.js";
import { raidListingParticipationSummary } from "./listing-view.js";
import { RAID_ASSIGN_CAPABILITY, RAID_CAPABILITY_DEFINITIONS, RAID_MODIFY_CAPABILITY, RAID_STAGE_CAPABILITY } from "./permissions.js";
import type { RaidDifficulty, RaidEligibility } from "./domain.js";

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
          { kind: "operate" as const, label: "Manage raid", requiresAnyCapability: [RAID_MODIFY_CAPABILITY, RAID_STAGE_CAPABILITY, RAID_ASSIGN_CAPABILITY] },
        ],
  };
}

async function raidTemporalRelevance(raidId: string): Promise<ActivityTemporalCoordinate | null> {
  const raid = await raidEventFactsIncludingCancelled(raidId);
  if (!raid) throw new Error(`Raid ${raidId} was not found while resolving Activity temporal relevance`);

  return raid.cancelledAtUnix === null
    ? { start: raid.occursAt[0], end: raid.occursAt.length === 2 ? raid.occursAt[1] : null }
    : null;
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
    },
    interaction: {
      destination(kind, activityId) {
        const id = encodeURIComponent(activityId);
        if (kind === "participate") return `/activities/raid/${id}/participation`;
        if (kind === "operate") return `/activities/raid/${id}/manage`;
        return null;
      },
    },
    temporal: {
      relevance: raidTemporalRelevance,
    },
  });
}
