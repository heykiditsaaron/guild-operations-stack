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
import { establishRaffleEventPublication } from "./calendar-listing.js";
import { publishRaffleOperationalException } from "./operational-exceptions.js";

export { RaffleRuleError, raffleClaimCutoffUnix, raffleClaimsAreOpen, type RaffleClaim, type RafflePrizeKind, type RaffleRound, type RaffleRoundConclusion, type RaffleRoundStatus, type RaffleRoundTerms };

function isSingleLiveRoundViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: unknown; constraint?: unknown };
  return databaseError.code === "23505" && databaseError.constraint === "raffle_rounds_one_live_per_guild_idx";
}

export async function createRaffleRound(actorGuildieId: string, terms: RaffleRoundTerms): Promise<RaffleRound> {
  return withTransaction(async (client) => { const round = await createRaffleRoundDomain(actorGuildieId, terms, client); await establishRaffleEventPublication(round, client); return round; });
}
export async function updateRaffleRound(actorGuildieId: string, roundId: string, terms: RaffleRoundTerms): Promise<RaffleRound> {
  return withTransaction(async (client) => { const round = await updateRaffleRoundDomain(actorGuildieId, roundId, terms, client); await establishRaffleEventPublication(round, client); return round; });
}
export async function activateRaffleRound(actorGuildieId: string, roundId: string): Promise<RaffleRound> {
  try { return await withTransaction(async (client) => { const round = await activateRaffleRoundDomain(actorGuildieId, roundId, client); await establishRaffleEventPublication(round, client); return round; }); }
  catch (error) { if (isSingleLiveRoundViolation(error)) throw new RaffleRuleError("active_round_exists", "Another raffle round is already live for the guild"); throw error; }
}
export async function cancelRaffleRound(actorGuildieId: string, roundId: string): Promise<RaffleRound> {
  return withTransaction(async (client) => { const round = await cancelRaffleRoundDomain(actorGuildieId, roundId, client); await establishRaffleEventPublication(round, client); return round; });
}
export async function submitRaffleClaim(claimantGuildieId: string, roundId: string, realmId: string, characterId: string, requestedEntryCount: number): Promise<RaffleClaim> {
  return submitRaffleClaimDomain(claimantGuildieId, roundId, realmId, characterId, requestedEntryCount);
}
export async function cancelOwnRaffleClaim(claimantGuildieId: string, claimId: string): Promise<void> { await cancelOwnRaffleClaimDomain(claimantGuildieId, claimId); }
export async function approveRaffleClaim(actorGuildieId: string, claimId: string): Promise<void> { await approveRaffleClaimDomain(actorGuildieId, claimId); }
export async function denyRaffleClaim(actorGuildieId: string, claimId: string, reasonInput: string): Promise<void> { await denyRaffleClaimDomain(actorGuildieId, claimId, reasonInput); }
export async function drawRaffleRound(actorGuildieId: string, roundId: string): Promise<RaffleRound> {
  const round = await withTransaction(async (client) => { const concluded = await drawRaffleRoundDomain(actorGuildieId, roundId, client); await establishRaffleEventPublication(concluded, client); return concluded; });
  if (round.conclusion === "drawn" && !round.winningClaimId) {
    console.error(`[raffle] drawn raffle round ${round.roundId} is missing its winning claim`);
    await publishRaffleOperationalException({ operation: "round.draw", actorGuildieId, summary: "Drawn raffle round is missing its winning claim.", details: { round_id: round.roundId, conclusion: round.conclusion } });
  }
  return round;
}
export async function getRaffleRound(roundId: string): Promise<RaffleRound | null> { return raffleRoundDomain(roundId); }
export async function listRaffleRoundClaims(roundId: string): Promise<RaffleClaim[]> { return raffleClaimsDomain(roundId); }
export async function getLiveRaffleRound(): Promise<RaffleRound | null> {
  const result = await pool.query<{ round_id: string }>(`SELECT round_id FROM raffle_rounds WHERE guild_id = $1 AND status = 'live'`, [config.guild.id]);
  if (result.rowCount === 0) return null;
  if ((result.rowCount ?? 0) > 1) throw new RaffleRuleError("multiple_live_rounds", "Raffle state is invalid: more than one live round exists for the guild", 500);
  return getRaffleRound(result.rows[0].round_id);
}
