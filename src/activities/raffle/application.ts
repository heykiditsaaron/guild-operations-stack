import { withTransaction } from "../../db.js";
import { deliverEmission, publishEmission } from "../../emissions/registry.js";
import { requireGuildCapabilityOrOperator } from "../../core/authority/guild-permissions.js";
import { RAFFLE_CLAIMS_CAPABILITY, RAFFLE_DRAW_CAPABILITY, RAFFLE_MODIFY_CAPABILITY, RAFFLE_STAGE_CAPABILITY } from "./permissions.js";
import {
  RaffleRuleError,
  approveRaffleClaim as approveRaffleClaimDomain,
  cancelRaffle as cancelRaffleDomain,
  pauseRaffleParticipation as pauseRaffleParticipationDomain,
  resumeRaffleParticipation as resumeRaffleParticipationDomain,
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
import { raffleOperationDestination, raffleParticipationDestination, rafflePublicDestination } from "./destinations.js";

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
  const persisted = await withTransaction(async (client) => {
    const raffle = await establishRaffleDomain(actorGuildieId, terms, client);
    const publication = await publishEmission(client, { code: "raffle.established", subject: raffle.raffleId });
    return { raffle, publication };
  });
  await deliverEmission(persisted.publication);
  return persisted.raffle;
}

export async function modifyRaffle(actorGuildieId: string, raffleId: string, terms: RaffleTerms): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorGuildieId, RAFFLE_MODIFY_CAPABILITY);
  const persisted = await withTransaction(async (client) => {
    const raffle = await modifyRaffleDomain(actorGuildieId, raffleId, terms, client);
    const publication = await publishEmission(client, { code: "raffle.modified", subject: raffle.raffleId });
    return { raffle, publication };
  });
  await deliverEmission(persisted.publication);
  return persisted.raffle;
}

export async function openRaffleParticipation(actorGuildieId: string, raffleId: string): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorGuildieId, RAFFLE_STAGE_CAPABILITY);
  return openRaffleParticipationDomain(actorGuildieId, raffleId);
}

export async function pauseRaffleParticipation(actorGuildieId: string, raffleId: string): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorGuildieId, RAFFLE_STAGE_CAPABILITY);
  return pauseRaffleParticipationDomain(actorGuildieId, raffleId);
}

export async function resumeRaffleParticipation(actorGuildieId: string, raffleId: string): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorGuildieId, RAFFLE_STAGE_CAPABILITY);
  return resumeRaffleParticipationDomain(actorGuildieId, raffleId);
}

export async function cancelRaffle(actorGuildieId: string, raffleId: string): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorGuildieId, RAFFLE_STAGE_CAPABILITY);
  const persisted = await withTransaction(async (client) => {
    const raffle = await cancelRaffleDomain(actorGuildieId, raffleId, client);
    const publication = await publishEmission(client, { code: "raffle.cancelled", subject: raffle.raffleId });
    return { raffle, publication };
  });
  await deliverEmission(persisted.publication);
  return persisted.raffle;
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
  const persisted = await withTransaction(async (client) => {
    const raffle = await drawRaffleDomain(actorGuildieId, raffleId, client);
    const publication = await publishEmission(client, { code: "raffle.concluded", subject: raffle.raffleId });
    return { raffle, publication };
  });
  const concluded = persisted.raffle;
  if (concluded.conclusion === "drawn" && !concluded.winningClaimId) {
    console.error(`[raffle] drawn Raffle ${concluded.raffleId} is missing its winning claim`);
    await publishRaffleOperationalException({
      operation: "raffle.draw",
      actorGuildieId,
      summary: "Drawn Raffle is missing its winning claim.",
      details: { raffle_id: concluded.raffleId, conclusion: concluded.conclusion },
    });
  }
  await deliverEmission(persisted.publication);
  return concluded;
}


export async function getRaffle(raffleId: string): Promise<Raffle | null> {
  return raffleDomain(raffleId);
}

export async function listRaffleClaims(raffleId: string): Promise<RaffleClaim[]> {
  return raffleClaimsDomain(raffleId);
}
