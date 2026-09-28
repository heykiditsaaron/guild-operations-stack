import { guildieHasGuildCapabilityOrOperator } from "../../core/authority/guild-permissions.js";
import {
  registerActivity,
  type ActivityOccurrenceAttribute,
} from "../../core/activity/registry.js";
import { getRaffleClaim, raffleFacts, raffleFactsForOperation } from "./queries.js";
import { RAFFLE_CAPABILITY_DEFINITIONS, RAFFLE_CLAIMS_CAPABILITY, RAFFLE_DRAW_CAPABILITY, RAFFLE_MODIFY_CAPABILITY, RAFFLE_STAGE_CAPABILITY } from "./permissions.js";

async function raffleOccurrence(raffleId: string) {
  const facts = await raffleFacts(raffleId);
  if (!facts) return null;
  const raffle = facts.raffle;

  const attributes: ActivityOccurrenceAttribute[] = [
    { kind: "entry_price", label: "Entry price", provenance: "declared", value: { type: "bigint", value: raffle.entryPriceGold, unit: "gold" } },
    { kind: "approved_entries", label: "Entries", provenance: "derived", value: { type: "integer", value: facts.metrics.approvedEntryCount } },
  ];

  if (raffle.prizeKind === "gold" && raffle.winnerPercentage !== null) {
    attributes.push({
      kind: "prize",
      label: "Prize",
      provenance: "declared",
      value: { type: "string", value: `${raffle.winnerPercentage}% of pot` },
    });
    const currentPrize = BigInt(raffle.entryPriceGold)
      * BigInt(facts.metrics.approvedEntryCount)
      * BigInt(raffle.winnerPercentage)
      / 100n;
    attributes.push({
      kind: "current_prize",
      label: "Current prize",
      provenance: "derived",
      value: { type: "bigint", value: currentPrize.toString(), unit: "gold" },
    });
  } else if (raffle.prizeDescription) {
    attributes.push({
      kind: "prize",
      label: "Prize",
      provenance: "declared",
      value: { type: "string", value: raffle.prizeDescription },
    });
  }

  return {
    occursAt: raffle.conclusion === "operator_cancelled" ? null : { start: null, end: raffle.drawingAtUnix },
    title: raffle.title ?? "Guild Raffle",
    description: raffle.prizeKind === "gold" ? null : raffle.prizeDescription,
    phase: raffle.conclusion === null ? "active" as const : "record" as const,
    attributes,
    interactions: raffle.conclusion !== null
      ? []
      : [
          ...(facts.participationOpen ? [{ kind: "participate" as const, label: "Enter raffle" }] : []),
          { kind: "operate" as const, label: "Manage raffle" },
        ],
  };
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
        return {
          title: claim.character.name,
          attributes: [
            { kind: "claim", label: "Entries requested", provenance: "declared", value: { type: "integer", value: claim.requestedEntryCount } },
            { kind: "promised_gold", label: "Gold promised", provenance: "declared", value: { type: "bigint", value: claim.promisedGoldValue, unit: "gold" } },
            { kind: "claim_state", label: "Claim", provenance: "derived", value: { type: "string", value: claim.resolutionKind ?? "Pending" } },
          ],
        };
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
