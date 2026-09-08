import { getRaffleRound } from "./application.js";
import type {
  RaffleClaimResolution,
  RafflePrizeKind,
  RaffleRoundConclusion,
  RaffleRoundStatus,
} from "./domain.js";
import {
  liveRaffleRoundFacts,
  raffleClaimFacts,
  raffleRoundFacts,
} from "./queries.js";

export type RaffleQueryRound = {
  roundId: string;
  status: RaffleRoundStatus;
  conclusion: RaffleRoundConclusion;
  drawingAtUnix: number;
  ticketPriceGold: string;
  prizeKind: RafflePrizeKind;
  winnerPercentage: number | null;
  prizeDescription: string | null;
  createdAtUnix: number;
  liveAtUnix: number | null;
  concludedAtUnix: number | null;
  claims: {
    pending: number;
    approved: number;
    denied: number;
    cancelled: number;
    approvedTickets: number;
  };
  gold: {
    pot: string;
    winnerPrize: string | null;
    guildShare: string | null;
  } | null;
  totalEntries: number | null;
  winningClaimId: string | null;
  winner: {
    claimId: string;
    characterName: string;
    realmId: string;
    realmName: string | null;
    realmSlug: string | null;
  } | null;
};

export type RaffleQueryClaim = {
  claimId: string;
  roundId: string;
  roundStatus: RaffleRoundStatus;
  roundConclusion: RaffleRoundConclusion;
  character: {
    characterId: string;
    name: string;
    realmId: string;
    realmName: string | null;
    realmSlug: string | null;
  };
  requestedTicketCount: number;
  promisedGoldValue: string;
  createdAtUnix: number;
  resolution: {
    kind: RaffleClaimResolution;
    atUnix: number | null;
    denialReason: string | null;
  };
};

function projectRound(facts: NonNullable<Awaited<ReturnType<typeof raffleRoundFacts>>>): RaffleQueryRound {
  const { round, metrics, winner } = facts;
  const pot = BigInt(round.ticketPriceGold) * BigInt(metrics.approvedEntryCount);
  const winnerPrize = round.prizeKind === "gold" && round.winnerPercentage !== null
    ? (pot * BigInt(round.winnerPercentage)) / 100n
    : null;
  const guildShare = winnerPrize === null ? null : pot - winnerPrize;

  return {
    roundId: round.roundId,
    status: round.status,
    conclusion: round.conclusion,
    drawingAtUnix: round.drawingAtUnix,
    ticketPriceGold: round.ticketPriceGold,
    prizeKind: round.prizeKind,
    winnerPercentage: round.winnerPercentage,
    prizeDescription: round.prizeDescription,
    createdAtUnix: round.createdAtUnix,
    liveAtUnix: round.liveAtUnix,
    concludedAtUnix: round.concludedAtUnix,
    claims: {
      pending: metrics.pendingClaimCount,
      approved: metrics.approvedClaimCount,
      denied: metrics.deniedClaimCount,
      cancelled: metrics.cancelledClaimCount,
      approvedTickets: metrics.approvedEntryCount,
    },
    gold: round.prizeKind === "gold"
      ? {
          pot: pot.toString(),
          winnerPrize: winnerPrize?.toString() ?? null,
          guildShare: guildShare?.toString() ?? null,
        }
      : null,
    totalEntries: round.totalEntries,
    winningClaimId: round.winningClaimId,
    winner: winner
      ? {
          claimId: winner.claimId,
          characterName: winner.character.name,
          realmId: winner.character.realmId,
          realmName: winner.character.realmName,
          realmSlug: winner.character.realmSlug,
        }
      : null,
  };
}

export async function raffleRoundQuery(roundId: string): Promise<RaffleQueryRound | null> {
  const facts = await raffleRoundFacts(roundId);
  return facts ? projectRound(facts) : null;
}

export async function liveRaffleRoundQuery(): Promise<RaffleQueryRound | null> {
  const facts = await liveRaffleRoundFacts();
  return facts ? projectRound(facts) : null;
}

export async function raffleClaimQuery(claimId: string): Promise<RaffleQueryClaim | null> {
  const claim = await raffleClaimFacts(claimId);
  if (!claim) return null;
  const round = await getRaffleRound(claim.roundId);
  if (!round) return null;

  return {
    claimId: claim.claimId,
    roundId: claim.roundId,
    roundStatus: round.status,
    roundConclusion: round.conclusion,
    character: claim.character,
    requestedTicketCount: claim.requestedTicketCount,
    promisedGoldValue: claim.promisedGoldValue,
    createdAtUnix: claim.createdAtUnix,
    resolution: {
      kind: claim.resolutionKind,
      atUnix: claim.resolutionAtUnix,
      denialReason: claim.denialReason,
    },
  };
}
