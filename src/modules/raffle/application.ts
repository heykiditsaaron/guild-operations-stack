import { config } from "../../config.js";
import { pool, withTransaction } from "../../db.js";
import {
  RaffleRuleError,
  activateRaffleRound as activateRaffleRoundDomain,
  approveRaffleClaim as approveRaffleClaimDomain,
  cancelOwnRaffleClaim as cancelOwnRaffleClaimDomain,
  cancelRaffleRound as cancelRaffleRoundDomain,
  createRaffleRound as createRaffleRoundDomain,
  denyRaffleClaim as denyRaffleClaimDomain,
  drawRaffleRound as drawRaffleRoundDomain,
  raffleClaimCutoffUnix,
  raffleClaims as raffleClaimsDomain,
  raffleClaimsAreOpen,
  raffleRound as raffleRoundDomain,
  submitRaffleClaim as submitRaffleClaimDomain,
  updateRaffleRound as updateRaffleRoundDomain,
  type RaffleClaim,
  type RafflePrizeKind,
  type RaffleRound,
  type RaffleRoundConclusion,
  type RaffleRoundStatus,
  type RaffleRoundTerms,
} from "./domain.js";
import { establishRaffleCalendarListing } from "./calendar-listing.js";
import { publishRaffleOperationalException } from "./operational-exceptions.js";
import { publishRaffleEvent } from "./publisher.js";

export {
  RaffleRuleError,
  raffleClaimCutoffUnix,
  raffleClaimsAreOpen,
  type RaffleClaim,
  type RafflePrizeKind,
  type RaffleRound,
  type RaffleRoundConclusion,
  type RaffleRoundStatus,
  type RaffleRoundTerms,
};

export type ActiveRaffleRoundOverview = RaffleRound & {
  approvedTicketCount: number;
};

function isSingleLiveRoundViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: unknown; constraint?: unknown };
  return databaseError.code === "23505"
    && databaseError.constraint === "raffle_rounds_one_live_per_guild_idx";
}

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

async function raffleRoundOverview(round: RaffleRound): Promise<ActiveRaffleRoundOverview> {
  const result = await pool.query<{ approved_ticket_count: number }>(
    `SELECT COALESCE(SUM(requested_ticket_count), 0)::int AS approved_ticket_count
       FROM raffle_claims
      WHERE round_id = $1
        AND resolution_kind = 'approved'`,
    [round.roundId],
  );

  return {
    ...round,
    approvedTicketCount: Number(result.rows[0]?.approved_ticket_count ?? 0),
  };
}

export async function createRaffleRound(
  actorGuildieId: string,
  terms: RaffleRoundTerms,
): Promise<RaffleRound> {
  return withTransaction(async (client) => {
    const round = await createRaffleRoundDomain(actorGuildieId, terms, client);
    await establishRaffleCalendarListing(round, client);
    return round;
  });
}

export async function updateRaffleRound(
  actorGuildieId: string,
  roundId: string,
  terms: RaffleRoundTerms,
): Promise<RaffleRound> {
  return withTransaction(async (client) => {
    const round = await updateRaffleRoundDomain(actorGuildieId, roundId, terms, client);
    await establishRaffleCalendarListing(round, client);
    return round;
  });
}

export async function activateRaffleRound(
  actorGuildieId: string,
  roundId: string,
): Promise<RaffleRound> {
  try {
    const round = await withTransaction(async (client) => {
      const activated = await activateRaffleRoundDomain(actorGuildieId, roundId, client);
      await establishRaffleCalendarListing(activated, client);
      return activated;
    });
    await publishRaffleEvent({ kind: "raffle.round.live", roundId: round.roundId });
    return round;
  } catch (error) {
    if (isSingleLiveRoundViolation(error)) {
      throw new RaffleRuleError(
        "active_round_exists",
        "Another raffle round is already live for the guild",
      );
    }
    throw error;
  }
}

export async function cancelRaffleRound(
  actorGuildieId: string,
  roundId: string,
): Promise<RaffleRound> {
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

export async function cancelOwnRaffleClaim(
  claimantGuildieId: string,
  claimId: string,
): Promise<void> {
  await cancelOwnRaffleClaimDomain(claimantGuildieId, claimId);
  await publishClaimEvent("raffle.claim.cancelled", claimId);
}

export async function approveRaffleClaim(
  actorGuildieId: string,
  claimId: string,
): Promise<void> {
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

export async function drawRaffleRound(
  actorGuildieId: string,
  roundId: string,
): Promise<RaffleRound> {
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

export async function getRaffleRound(roundId: string): Promise<RaffleRound | null> {
  return raffleRoundDomain(roundId);
}

export async function listRaffleRoundClaims(roundId: string): Promise<RaffleClaim[]> {
  return raffleClaimsDomain(roundId);
}

export async function getLiveRaffleRound(): Promise<RaffleRound | null> {
  const result = await pool.query<{ round_id: string }>(
    `SELECT round_id
       FROM raffle_rounds
      WHERE guild_id = $1
        AND status = 'live'`,
    [config.guild.id],
  );

  if (result.rowCount === 0) return null;
  if ((result.rowCount ?? 0) > 1) {
    throw new RaffleRuleError(
      "multiple_live_rounds",
      "Raffle state is invalid: more than one live round exists for the guild",
      500,
    );
  }

  return getRaffleRound(result.rows[0].round_id);
}

export async function getLiveRaffleRoundOverview(): Promise<ActiveRaffleRoundOverview | null> {
  const round = await getLiveRaffleRound();
  return round ? raffleRoundOverview(round) : null;
}

export async function getNextListedRaffleRoundOverview(): Promise<ActiveRaffleRoundOverview | null> {
  const result = await pool.query<{ round_id: string }>(
    `SELECT round_id
       FROM raffle_rounds
      WHERE guild_id = $1
        AND status = 'listed'
      ORDER BY drawing_at_unix ASC, created_at_unix ASC, round_id ASC
      LIMIT 1`,
    [config.guild.id],
  );

  const roundId = result.rows[0]?.round_id;
  if (!roundId) return null;
  const round = await getRaffleRound(roundId);
  return round ? raffleRoundOverview(round) : null;
}
