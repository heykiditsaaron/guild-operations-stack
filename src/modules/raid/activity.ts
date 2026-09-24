import {
  registerActivityTemporalIntegration,
  type ActivityTemporalProjection,
} from "../../core/activity/temporal.js";
import { raidEventFactsIncludingCancelled } from "./application.js";

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
  registerActivityTemporalIntegration({
    activityKind: "raid",
    emissionCodes: RAID_TEMPORAL_EMISSION_CODES,
    temporalProjection: raidTemporalProjection,
  });
}
