import {
  registerActivityTemporalIntegration,
  type ActivityTemporalProjection,
} from "../../core/activity/temporal.js";
import { getRaffle } from "./application.js";

const RAFFLE_TEMPORAL_EMISSION_CODES = [
  "raffle.established",
  "raffle.modified",
  "raffle.concluded",
  "raffle.cancelled",
] as const;

async function raffleTemporalProjection(raffleId: string): Promise<ActivityTemporalProjection> {
  const raffle = await getRaffle(raffleId);
  if (!raffle) throw new Error(`Raffle ${raffleId} was not found while resolving Activity temporal relevance`);

  return {
    activityKind: "raffle",
    activityId: raffle.raffleId,
    occursAt: raffle.conclusion === "operator_cancelled" ? null : [raffle.drawingAtUnix],
  };
}

export function registerRaffleActivityIntegration(): void {
  registerActivityTemporalIntegration({
    activityKind: "raffle",
    emissionCodes: RAFFLE_TEMPORAL_EMISSION_CODES,
    temporalProjection: raffleTemporalProjection,
  });
}
