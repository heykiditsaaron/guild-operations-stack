import {
  RAFFLE_CLAIMS_CAPABILITY,
  RAFFLE_DRAW_CAPABILITY,
  RAFFLE_MODIFY_CAPABILITY,
  RAFFLE_STAGE_CAPABILITY,
  requireGuildCapabilityOrOperator,
} from "../../guild-permissions.js";
import {
  RaffleRuleError,
  approveRaffleClaim as approveRaffleClaimDomain,
  cancelRaffle as cancelRaffleDomain,
  closeRaffleParticipation as closeRaffleParticipationDomain,
  denyRaffleClaim as denyRaffleClaimDomain,
  drawRaffle as drawRaffleDomain,
  establishRaffle as establishRaffleDomain,
  establishRaffleClaim as establishRaffleClaimDomain,
  modifyRaffle as modifyRaffleDomain,
  openRaffleParticipation as openRaffleParticipationDomain,
  raffle as raffleDomain,
  raffleClaims as raffleClaimsDomain,
  raffleParticipationCutoffUnix,
  raffleParticipationIsOpen,
  revokeRaffleClaim as revokeRaffleClaimDomain,
  type Raffle,
  type RaffleClaim,
  type RaffleConclusion,
  type RafflePrizeKind,
  type RaffleTerms,
} from "./domain.js";
import { publishRaffleOperationalException } from "./operational-exceptions.js";

export {
  RaffleRuleError,
  raffleParticipationCutoffUnix,
  raffleParticipationIsOpen,
  type Raffle,
  type RaffleClaim,
  type RaffleConclusion,
  type RafflePrizeKind,
  type RaffleTerms,
};

export async function establishRaffle(actorGuildieId: string, terms: RaffleTerms): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorGuildieId, RAFFLE_MODIFY_CAPABILITY);
  return establishRaffleDomain(actorGuildieId, terms);
}

export async function modifyRaffle(actorGuildieId: string, raffleId: string, terms: RaffleTerms): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorGuildieId, RAFFLE_MODIFY_CAPABILITY);
  return modifyRaffleDomain(actorGuildieId, raffleId, terms);
}

export async function openRaffleParticipation(actorGuildieId: string, raffleId: string): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorGuildieId, RAFFLE_STAGE_CAPABILITY);
  return openRaffleParticipationDomain(actorGuildieId, raffleId);
}

export async function closeRaffleParticipation(actorGuildieId: string, raffleId: string): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorGuildieId, RAFFLE_STAGE_CAPABILITY);
  return closeRaffleParticipationDomain(actorGuildieId, raffleId);
}

export async function cancelRaffle(actorGuildieId: string, raffleId: string): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorGuildieId, RAFFLE_STAGE_CAPABILITY);
  return cancelRaffleDomain(actorGuildieId, raffleId);
}

export async function establishRaffleClaim(
  claimantGuildieId: string,
  raffleId: string,
  realmId: string,
  characterId: string,
  requestedEntryCount: number,
): Promise<RaffleClaim> {
  return establishRaffleClaimDomain(claimantGuildieId, raffleId, realmId, characterId, requestedEntryCount);
}

export async function revokeRaffleClaim(claimantGuildieId: string, claimId: string): Promise<void> {
  await revokeRaffleClaimDomain(claimantGuildieId, claimId);
}

export async function approveRaffleClaim(actorGuildieId: string, claimId: string): Promise<void> {
  await requireGuildCapabilityOrOperator(actorGuildieId, RAFFLE_CLAIMS_CAPABILITY);
  await approveRaffleClaimDomain(actorGuildieId, claimId);
}

export async function denyRaffleClaim(actorGuildieId: string, claimId: string, reasonInput: string): Promise<void> {
  await requireGuildCapabilityOrOperator(actorGuildieId, RAFFLE_CLAIMS_CAPABILITY);
  await denyRaffleClaimDomain(actorGuildieId, claimId, reasonInput);
}

export async function drawRaffle(actorGuildieId: string, raffleId: string): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorGuildieId, RAFFLE_DRAW_CAPABILITY);
  const concluded = await drawRaffleDomain(actorGuildieId, raffleId);
  if (concluded.conclusion === "drawn" && !concluded.winningClaimId) {
    console.error(`[raffle] drawn Raffle ${concluded.raffleId} is missing its winning claim`);
    await publishRaffleOperationalException({
      operation: "raffle.draw",
      actorGuildieId,
      summary: "Drawn Raffle is missing its winning claim.",
      details: { raffle_id: concluded.raffleId, conclusion: concluded.conclusion },
    });
  }
  return concluded;
}

export async function getRaffle(raffleId: string): Promise<Raffle | null> {
  return raffleDomain(raffleId);
}

export async function listRaffleClaims(raffleId: string): Promise<RaffleClaim[]> {
  return raffleClaimsDomain(raffleId);
}
