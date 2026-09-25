import {
  registerActivity,
  type ActivityTemporalProjection,
} from "../../core/activity/registry.js";
import { raidEventFactsIncludingCancelled, raidCalendarProjection } from "./application.js";
import { RAID_CAPABILITY_DEFINITIONS } from "./permissions.js";

const RAID_TEMPORAL_EMISSION_CODES = [
  "raid.established",
  "raid.modified",
  "raid.cancelled",
] as const;

async function raidTemporalProjection(raidId: string): Promise<ActivityTemporalProjection> {
  const raid = await raidEventFactsIncludingCancelled(raidId);
  if (!raid) throw new Error(`Raid ${raidId} was not found while resolving Activity temporal relevance`);

  return {
    activityKind: "raid",
    activityId: raid.raidId,
    occursAt: raid.cancelledAtUnix === null ? raid.occursAt : null,
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
    participation: {
      destination(reference) {
        return `/activities/raid/${encodeURIComponent(reference.activityId)}`;
      },
    },
    temporal: {
      emissionCodes: RAID_TEMPORAL_EMISSION_CODES,
      projection: raidTemporalProjection,
      presentation: raidCalendarProjection,
    },
  });
}
