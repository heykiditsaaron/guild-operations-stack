import type {
  RaffleClaimResolution,
  RafflePrizeKind,
  RaffleRoundConclusion,
  RaffleRoundStatus,
} from "./domain.js";
import { raffleGuildieAttribution } from "./guildie-attribution.js";
import { raffleClaimFactsForRound, raffleRoundFacts } from "./queries.js";

export type RafflePublicClaim = {
  claimId: string;
  characterName: string;
  requestedTicketCount: number;
  promisedGoldValue: string;
  createdAtUnix: number;
  resolutionKind: RaffleClaimResolution;
  resolutionActorLabel: string | null;
  resolvedAtUnix: number | null;
  denialReason: string | null;
};

export type RafflePublicRound = {
  roundId: string;
  status: RaffleRoundStatus;
  conclusion: RaffleRoundConclusion;
  roundTitle: string | null;
  drawingAtUnix: number;
  ticketPriceGold: string;
  prizeKind: RafflePrizeKind;
  winnerPercentage: number | null;
  prizeDescription: string | null;
  createdAtUnix: number;
  liveAtUnix: number | null;
  concludedAtUnix: number | null;
  totalEntries: number | null;
  approvedEntryCount: number;
  winnerCharacterName: string | null;
  claims: RafflePublicClaim[];
};

export async function rafflePublicRound(roundId: string): Promise<RafflePublicRound | null> {
  const [facts, claims] = await Promise.all([
    raffleRoundFacts(roundId),
    raffleClaimFactsForRound(roundId),
  ]);
  if (!facts) return null;

  const actorGuildieIds = new Set(
    claims
      .map((claim) => claim.resolutionActorGuildieId)
      .filter((guildieId): guildieId is string => guildieId !== null),
  );
  const attributionEntries = await Promise.all(
    [...actorGuildieIds].map(async (guildieId) => [guildieId, await raffleGuildieAttribution(guildieId)] as const),
  );
  const attributionByGuildieId = new Map(attributionEntries);

  return {
    roundId: facts.round.roundId,
    status: facts.round.status,
    conclusion: facts.round.conclusion,
    roundTitle: facts.round.roundTitle,
    drawingAtUnix: facts.round.drawingAtUnix,
    ticketPriceGold: facts.round.ticketPriceGold,
    prizeKind: facts.round.prizeKind,
    winnerPercentage: facts.round.winnerPercentage,
    prizeDescription: facts.round.prizeDescription,
    createdAtUnix: facts.round.createdAtUnix,
    liveAtUnix: facts.round.liveAtUnix,
    concludedAtUnix: facts.round.concludedAtUnix,
    totalEntries: facts.round.totalEntries,
    approvedEntryCount: facts.metrics.approvedEntryCount,
    winnerCharacterName: facts.winner?.character.name ?? null,
    claims: claims.map((claim) => ({
      claimId: claim.claimId,
      characterName: claim.character.name,
      requestedTicketCount: claim.requestedTicketCount,
      promisedGoldValue: claim.promisedGoldValue,
      createdAtUnix: claim.createdAtUnix,
      resolutionKind: claim.resolutionKind,
      resolutionActorLabel: claim.resolutionActorGuildieId === null
        ? null
        : attributionByGuildieId.get(claim.resolutionActorGuildieId) ?? "Guild officer",
      resolvedAtUnix: claim.resolutionAtUnix,
      denialReason: claim.denialReason,
    })),
  };
}
