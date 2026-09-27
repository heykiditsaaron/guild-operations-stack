import {
  registerActivity,
  type ActivityOccurrenceAttribute,
} from "../../core/activity/registry.js";
import { raffleFacts } from "./queries.js";
import { RAFFLE_CAPABILITY_DEFINITIONS } from "./permissions.js";

async function raffleOccurrence(raffleId: string) {
  const facts = await raffleFacts(raffleId);
  if (!facts) return null;
  const raffle = facts.raffle;

  const attributes: ActivityOccurrenceAttribute[] = [
    { key: "entry_price", label: "Entry price", provenance: "declared", value: { kind: "quantity", value: raffle.entryPriceGold, unit: "gold" } },
    { key: "approved_entries", label: "Entries", provenance: "derived", value: { kind: "number", value: facts.metrics.approvedEntryCount } },
  ];

  if (raffle.prizeKind === "gold" && raffle.winnerPercentage !== null) {
    attributes.push({
      key: "prize",
      label: "Prize",
      provenance: "declared",
      value: { kind: "text", value: `${raffle.winnerPercentage}% of pot` },
    });
    const currentPrize = BigInt(raffle.entryPriceGold)
      * BigInt(facts.metrics.approvedEntryCount)
      * BigInt(raffle.winnerPercentage)
      / 100n;
    attributes.push({
      key: "current_prize",
      label: "Current prize",
      provenance: "derived",
      value: { kind: "quantity", value: currentPrize.toString(), unit: "gold" },
    });
  } else if (raffle.prizeDescription) {
    attributes.push({
      key: "prize",
      label: "Prize",
      provenance: "declared",
      value: { kind: "text", value: raffle.prizeDescription },
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
    },
    interaction: {
      destination(kind, activityId) {
        const id = encodeURIComponent(activityId);
        if (kind === "participate") return `/activities/raffle/enter?raffle=${id}`;
        if (kind === "operate") return `/activities/raffle/${id}/manage`;
        return null;
      },
    },
  });
}
