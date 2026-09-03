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

async function roundIdForClaim(claimId: string): Promise<string> {
  const result = await pool.query<{ round_id: string }>(
    `SELECT round_id FROM raffle_claims WHERE claim_id = $1`,
    [claimId],
  );
  if (!result.rowCount) {
    throw new Error(`Resolved raffle claim ${claimId} could not be read for publication`);
  }
  return result.rows[0].round_id;
}

export async function cancelRaffleRound(actorSubjectId: string, roundId: string): Promise<RaffleRound> {
  const round = await cancelRaffleRoundDomain(actorSubjectId, roundId);
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
  const roundId = await roundIdForClaim(claimId);
  await publishRaffleEvent({ kind: "raffle.claim.cancelled", roundId, claimId });
}

export async function approveRaffleClaim(actorSubjectId: string, claimId: string): Promise<void> {
  await approveRaffleClaimDomain(actorSubjectId, claimId);
  const roundId = await roundIdForClaim(claimId);
  await publishRaffleEvent({ kind: "raffle.claim.approved", roundId, claimId });
}

export async function denyRaffleClaim(
  actorSubjectId: string,
  claimId: string,
  reasonInput: string,
): Promise<void> {
  await denyRaffleClaimDomain(actorSubjectId, claimId, reasonInput);
  const roundId = await roundIdForClaim(claimId);
  await publishRaffleEvent({ kind: "raffle.claim.denied", roundId, claimId });
}

export async function drawRaffleRound(actorSubjectId: string, roundId: string): Promise<RaffleRound> {
  const round = await drawRaffleRoundDomain(actorSubjectId, roundId);

  if (round.status === "drawn") {
    if (!round.winningClaimId) {
      throw new Error(`Drawn raffle round ${round.roundId} has no winning claim`);
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
