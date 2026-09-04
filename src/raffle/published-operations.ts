import { pool } from "../db.js";
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
import { publishRaffleEvent } from "./publisher.js";
import { coupleGuildEventRegistration } from "./registered-operations.js";

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

export async function cancelRaffleRound(actorSubjectId: string, roundId: string): Promise<RaffleRound> {
  const round = await cancelRaffleRoundDomain(actorSubjectId, roundId);
  await coupleGuildEventRegistration(round);
  await publishRaffleEvent({ kind: "raffle.round.cancelled", roundId: round.roundId });
  return round;
}

export async function submitRaffleClaim(
  subjectId: string,
  roundId: string,
  realmId: string,
  characterId: string,
  requestedTicketCount: number,
): Promise<RaffleClaim> {
  const claim = await submitRaffleClaimDomain(
    subjectId,
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

export async function cancelOwnRaffleClaim(subjectId: string, claimId: string): Promise<void> {
  await cancelOwnRaffleClaimDomain(subjectId, claimId);
  await publishClaimEvent("raffle.claim.cancelled", claimId);
}

export async function approveRaffleClaim(actorSubjectId: string, claimId: string): Promise<void> {
  await approveRaffleClaimDomain(actorSubjectId, claimId);
  await publishClaimEvent("raffle.claim.approved", claimId);
}

export async function denyRaffleClaim(
  actorSubjectId: string,
  claimId: string,
  reasonInput: string,
): Promise<void> {
  await denyRaffleClaimDomain(actorSubjectId, claimId, reasonInput);
  await publishClaimEvent("raffle.claim.denied", claimId);
}

export async function drawRaffleRound(actorSubjectId: string, roundId: string): Promise<RaffleRound> {
  const round = await drawRaffleRoundDomain(actorSubjectId, roundId);
  await coupleGuildEventRegistration(round);

  if (round.status === "drawn") {
    if (!round.winningClaimId) {
      console.error(`[raffle-publisher] drawn raffle round ${round.roundId} has no winning claim to publish`);
      return round;
    }
    await publishRaffleEvent({
      kind: "raffle.round.drawn",
      roundId: round.roundId,
      winningClaimId: round.winningClaimId,
    });
  } else if (round.status === "no_entry_cancelled") {
    await publishRaffleEvent({
      kind: "raffle.round.no-entry-cancelled",
      roundId: round.roundId,
    });
  }

  return round;
}
