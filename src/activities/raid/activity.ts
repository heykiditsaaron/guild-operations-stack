import {
  registerActivity,
  type ActivityOccurrenceAttribute,
  type ActivityTemporalRelevance,
} from "../../core/activity/registry.js";
import {
  raidEventFacts,
  raidEventFactsIncludingCancelled,
  raidRosterDiagnostics,
} from "./application.js";
import { raidListingParticipationSummary } from "./listing-view.js";
import { RAID_CAPABILITY_DEFINITIONS } from "./permissions.js";
import type { RaidDifficulty, RaidEligibility } from "./domain.js";

const RAID_TEMPORAL_EMISSION_CODES = [
  "raid.established",
  "raid.modified",
  "raid.cancelled",
] as const;

function difficultyLabel(value: RaidDifficulty): string {
  return value[0].toUpperCase() + value.slice(1);
}

function eligibilityLabel(value: RaidEligibility): string {
  if (value === "guild_character_member") return "Guild Character Member";
  if (value === "guildie") return "Guildie";
  return "Anyone";
}

async function raidOccurrence(raidId: string) {
  const raid = await raidEventFacts(raidId);
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
    occursAt: raid.occursAt,
    title: raid.label,
    description: raid.description,
    attributes,
  };
}

async function raidTemporalRelevance(raidId: string): Promise<ActivityTemporalRelevance | null> {
  const raid = await raidEventFactsIncludingCancelled(raidId);
  if (!raid) throw new Error(`Raid ${raidId} was not found while resolving Activity temporal relevance`);

  return raid.cancelledAtUnix === null ? raid.occursAt : null;
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
    participation: {
      destination(reference) {
        return `/activities/raid/${encodeURIComponent(reference.activityId)}`;
      },
    },
    temporal: {
      emissionCodes: RAID_TEMPORAL_EMISSION_CODES,
      relevance: raidTemporalRelevance,
    },
  });
}
