import { pool, withTransaction } from "../../db.js";
import {
  approveRaffleClaim as approveRaffleClaimDomain,
  cancelOwnRaffleClaim as cancelOwnRaffleClaimDomain,
  cancelRaffleRound as cancelRaffleRoundDomain,
  denyRaffleClaim as denyRaffleClaimDomain,
  drawRaffleRound as drawRaffleRoundDomain,
  submitRaffleClaim as submitRaffleClaimDomain,
  type RaffleClaim,
  type RaffleRound,
} from "./domain.js";
import { establishRaffleCalendarListing } from "./calendar-listing.js";
import { publishRaffleOperationalException } from "./operational-exceptions.js";
import { publishRaffleEvent } from "./publisher.js";

async function publishClaimEvent(
  kind: "raffle.claim.approved" | "raffle.claim.denied" | "raffle.claim.cancelled",
  claimId: string,
): Promise<void> {
  try {
    const result = await pool.query<{ round_id: string }>(
      `SELECT round_id FROM raffle_claims WHERE claim_id = $1`,
      [claimId],
    );
    const roundId = result.rows[0]?.round_id;
    if (!roundId) {
      console.error(`[raffle-publisher] claim ${claimId} could not be resolved for ${kind}`);
      return;
    }
    await publishRaffleEvent({ kind, roundId, claimId });
  } catch (error) {
    console.error(`[raffle-publisher] claim ${claimId} could not be published for ${kind}`, error);
  }
}

export async function cancelRaffleRound(actorGuildieId: string, roundId: string): Promise<RaffleRound> {
  const round = await withTransaction(async (client) => {
    const cancelled = await cancelRaffleRoundDomain(actorGuildieId, roundId, client);
    await establishRaffleCalendarListing(cancelled, client);
    return cancelled;
  });
  await publishRaffleEvent({ kind: "raffle.round.cancelled", roundId: round.roundId });
  return round;
}

export async function submitRaffleClaim(
  claimantGuildieId: string,
  roundId: string,
  realmId: string,
  characterId: string,
  requestedTicketCount: number,
): Promise<RaffleClaim> {
  const claim = await submitRaffleClaimDomain(
    claimantGuildieId,
    roundId,
    realmId,
    characterId,
    requestedTicketCount,
  );
  await publishRaffleEvent({
    kind: "raffle.claim.submitted",
    roundId: claim.roundId,
    claimId: claim.claimId,
  });
  return claim;
}

export async function cancelOwnRaffleClaim(claimantGuildieId: string, claimId: string): Promise<void> {
  await cancelOwnRaffleClaimDomain(claimantGuildieId, claimId);
  await publishClaimEvent("raffle.claim.cancelled", claimId);
}

export async function approveRaffleClaim(actorGuildieId: string, claimId: string): Promise<void> {
  await approveRaffleClaimDomain(actorGuildieId, claimId);
  await publishClaimEvent("raffle.claim.approved", claimId);
}

export async function denyRaffleClaim(
  actorGuildieId: string,
  claimId: string,
  reasonInput: string,
): Promise<void> {
  await denyRaffleClaimDomain(actorGuildieId, claimId, reasonInput);
  await publishClaimEvent("raffle.claim.denied", claimId);
}

export async function drawRaffleRound(actorGuildieId: string, roundId: string): Promise<RaffleRound> {
  const round = await withTransaction(async (client) => {
    const concluded = await drawRaffleRoundDomain(actorGuildieId, roundId, client);
    await establishRaffleCalendarListing(concluded, client);
    return concluded;
  });

  if (round.conclusion === "drawn") {
    if (!round.winningClaimId) {
      console.error(`[raffle-publisher] drawn raffle round ${round.roundId} has no winning claim to publish`);
      await publishRaffleOperationalException({
        operation: "round.draw",
        actorGuildieId,
        summary: "Drawn raffle round is missing its winning claim.",
        details: {
          round_id: round.roundId,
          conclusion: round.conclusion,
        },
      });
      return round;
    }
    await publishRaffleEvent({
      kind: "raffle.round.drawn",
      roundId: round.roundId,
      winningClaimId: round.winningClaimId,
    });
  } else if (round.conclusion === "no_participation") {
    await publishRaffleEvent({
      kind: "raffle.round.no-entry-cancelled",
      roundId: round.roundId,
    });
  }

  return round;
}
