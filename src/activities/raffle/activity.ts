import type { ActivitySharedValue } from "../../core/activity/registry.js";
import { activityParticipationOfferByProcedureReference } from "../../core/activity/participation.js";
import { pool } from "../../db.js";
import { guildieHasGuildCapabilityOrOperator } from "../../core/authority/guild-permissions.js";
import {
  registerActivity,
} from "../../core/activity/registry.js";
import { getRaffleClaim, raffleFacts, raffleFactsForOperation } from "./queries.js";
import { RAFFLE_CAPABILITY_DEFINITIONS, RAFFLE_CLAIMS_CAPABILITY, RAFFLE_DRAW_CAPABILITY, RAFFLE_MODIFY_CAPABILITY, RAFFLE_STAGE_CAPABILITY } from "./permissions.js";
import { raffleOccurrenceProjection } from "./occurrence.js";

async function raffleOccurrence(raffleId: string) {
  const facts = await raffleFacts(raffleId);
  return facts ? raffleOccurrenceProjection(facts.raffle, facts.metrics.approvedEntryCount, facts.participationOpen) : null;
}

export function registerRaffleActivityIntegration(): void {
  registerActivity({
    kind: "raffle",
    administration: { capabilities: RAFFLE_CAPABILITY_DEFINITIONS },
    discovery: {
      title: "Raffle",
      tagline: "Take your shot at the pot.",
      destination: "/activities/raffle",
    },
    kindInteraction: {
      label() { return "Create Raffle"; },
      destination() { return "/activities/raffle/manage?create=1"; },
      async availableTo(_kind, guildieId) {
        return guildieId ? guildieHasGuildCapabilityOrOperator(guildieId, RAFFLE_MODIFY_CAPABILITY) : false;
      },
    },
    occurrence: {
      resolve: raffleOccurrence,
      async list() {
        return (await raffleFactsForOperation()).map((facts) => facts.raffle.raffleId);
      },
    },
    participation: {
      async project(activityId, procedureReference) {
        const claim = await getRaffleClaim(procedureReference);
        if (!claim || claim.raffleId !== activityId) return null;
        const offer = await pool.connect();
        try {
          const participationOffer = await activityParticipationOfferByProcedureReference(offer, {
            activityKind: "raffle",
            activityId,
            procedureReference,
          });
          if (!participationOffer) return null;
          const characterComponent = participationOffer.components.find((component) => component.kind === "character")?.value;
          const claimComponent = participationOffer.components.find((component) => component.kind === "claim")?.value;
          if (Array.isArray(characterComponent) || Array.isArray(claimComponent)) return null;
          const characterValue = characterComponent as ActivitySharedValue | undefined;
          const claimValue = claimComponent as ActivitySharedValue | undefined;
          if (characterValue?.type !== "guild_character" || claimValue?.type !== "integer") return null;
          return {
            title: characterValue.value.name,
            attributes: [
              { kind: "claim", label: "Entries requested", provenance: "declared", value: claimValue },
              { kind: "promised_gold", label: "Gold promised", provenance: "declared", value: { type: "bigint", value: claim.promisedGoldValue, unit: "gold" } },
              { kind: "claim_state", label: "Claim", provenance: "derived", value: { type: "string", value: claim.resolutionKind ?? "Pending" } },
            ],
          };
        } finally {
          offer.release();
        }
      },
    },
    interaction: {
      async availableTo(kind, _activityId, guildieId) {
        if (kind !== "operate") return true;
        if (!guildieId) return false;
        const permitted = await Promise.all([
          RAFFLE_MODIFY_CAPABILITY,
          RAFFLE_STAGE_CAPABILITY,
          RAFFLE_CLAIMS_CAPABILITY,
          RAFFLE_DRAW_CAPABILITY,
        ].map((capability) => guildieHasGuildCapabilityOrOperator(guildieId, capability)));
        return permitted.some(Boolean);
      },
      destination(kind, activityId) {
        const id = encodeURIComponent(activityId);
        if (kind === "participate") return `/activities/raffle/enter?raffle=${id}`;
        if (kind === "operate") return `/activities/raffle/${id}/manage`;
        return null;
      },
    },
  });
}
