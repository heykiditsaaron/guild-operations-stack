import type { ActivityOccurrenceAttribute } from "../../core/activity/registry.js";
import type { Raffle } from "./domain.js";

export function raffleOccurrenceProjection(raffle: Raffle, approvedEntryCount: number, participationOpen: boolean) {
  const attributes: ActivityOccurrenceAttribute[] = [
    { kind: "entry_price", label: "Entry price", provenance: "declared", value: { type: "bigint", value: raffle.entryPriceGold, unit: "gold" } },
    { kind: "approved_entries", label: "Entries", provenance: "derived", value: { type: "integer", value: approvedEntryCount } },
  ];

  if (raffle.prizeKind === "gold" && raffle.winnerPercentage !== null) {
    attributes.push({ kind: "prize", label: "Prize", provenance: "declared", value: { type: "string", value: `${raffle.winnerPercentage}% of pot` } });
    const prize = BigInt(raffle.entryPriceGold) * BigInt(approvedEntryCount) * BigInt(raffle.winnerPercentage) / 100n;
    attributes.push({ kind: "current_prize", label: raffle.conclusion === null ? "Current prize" : "Prize value", provenance: "derived", value: { type: "bigint", value: prize.toString(), unit: "gold" } });
  } else if (raffle.prizeDescription) {
    attributes.push({ kind: "prize", label: "Prize", provenance: "declared", value: { type: "string", value: raffle.prizeDescription } });
  }

  if (raffle.conclusion !== null) {
    attributes.push({ kind: "conclusion", label: "Conclusion", provenance: "derived", value: { type: "string", value: raffle.conclusion } });
  }
  if (raffle.conclusion === "drawn" && raffle.winningParticipationOfferId) {
    attributes.push({ kind: "winner", label: "Winning offer", provenance: "derived", value: { type: "participation_offer", value: raffle.winningParticipationOfferId } });
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
          ...(participationOpen ? [{ kind: "participate" as const, label: "Enter raffle" }] : []),
          { kind: "operate" as const, label: "Manage raffle" },
        ],
  };
}
