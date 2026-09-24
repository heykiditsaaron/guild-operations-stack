import {
  registerActivity,
  type ActivityTemporalProjection,
} from "../../core/activity/registry.js";
import { getRaffle, raffleCalendarProjection } from "./application.js";
import { raffleParticipationReferencesForGuildie } from "./queries.js";

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
  registerActivity({
    kind: "raffle",
    discovery: {
      title: "Raffle",
      tagline: "Take your shot at the pot.",
      destination: "/events/raffle",
    },
    participation: {
      destination(reference) {
        return `/events/raffle/${encodeURIComponent(reference.activityId)}`;
      },
      async forGuildie(guildieId) {
        const references = await raffleParticipationReferencesForGuildie(guildieId);
        return references.map((reference) => ({
          activityKind: "raffle",
          activityId: reference.raffleId,
          participationId: reference.claimId,
        }));
      },
    },
    temporal: {
      emissionCodes: RAFFLE_TEMPORAL_EMISSION_CODES,
      projection: raffleTemporalProjection,
      presentation: raffleCalendarProjection,
    },
  });
}
