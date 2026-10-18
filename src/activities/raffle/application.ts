import { withTransaction } from "../../db.js";
import { deliverEmission, publishEmission } from "../../emissions/registry.js";
import { publishActivityDeclaration } from "../../core/activity/declarations.js";
import { freezeActivityOccurrence } from "../../core/activity/records.js";
import { requireGuildCapabilityOrOperator } from "../../core/authority/guild-permissions.js";
import { RAFFLE_CLAIMS_CAPABILITY, RAFFLE_DRAW_CAPABILITY, RAFFLE_MODIFY_CAPABILITY, RAFFLE_STAGE_CAPABILITY } from "./permissions.js";
import {
  RaffleRuleError,
  approvedRaffleEntryCount,
  approveRaffleClaim as approveRaffleClaimDomain,
  cancelRaffle as cancelRaffleDomain,
  pauseRaffleParticipation as pauseRaffleParticipationDomain,
  resumeRaffleParticipation as resumeRaffleParticipationDomain,
  denyRaffleClaim as denyRaffleClaimDomain,
  drawRaffle as drawRaffleDomain,
  establishRaffle as establishRaffleDomain,
  establishRaffleClaim as establishRaffleClaimDomain,
  establishDeclaredRaffleClaim as establishDeclaredRaffleClaimDomain,
  establishRaffleClaimFromParticipationContext as establishRaffleClaimFromParticipationContextDomain,
  modifyRaffle as modifyRaffleDomain,
  openRaffleParticipation as openRaffleParticipationDomain,
  raffle as raffleDomain,
  raffleClaims as raffleClaimsDomain,
  raffleParticipationCutoffUnix,
  raffleParticipationIsOpen,
  raffleParticipationOfferWorkspace as raffleParticipationOfferWorkspaceDomain,
  revokeRaffleClaim as revokeRaffleClaimDomain,
  revokeRaffleClaimForActor as revokeRaffleClaimForActorDomain,
  type Raffle,
  type RaffleClaim,
  type RaffleConclusion,
  type RafflePrizeKind,
  type RaffleTerms,
} from "./domain.js";
import { publishRaffleOperationalException } from "./operational-exceptions.js";
import { raffleOperationDestination, raffleParticipationDestination, rafflePublicDestination } from "./destinations.js";
import { raffleOccurrenceProjection } from "./occurrence.js";

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

export async function establishRaffle(actorIdentityId: string, terms: RaffleTerms): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorIdentityId, RAFFLE_MODIFY_CAPABILITY);
  const persisted = await withTransaction(async (client) => {
    const raffle = await establishRaffleDomain(actorIdentityId, terms, client);
    const publication = await publishEmission(client, { code: "raffle.established", subject: raffle.raffleId });
    const activityDeclaration = await publishActivityDeclaration(client, { kind: "temporal-relevance-changed", activityKind: "raffle", activityId: raffle.raffleId });
    return { raffle, publication, activityDeclaration };
  });
  await deliverEmission(persisted.publication);
  await deliverEmission(persisted.activityDeclaration);
  return persisted.raffle;
}

export async function modifyRaffle(actorIdentityId: string, raffleId: string, terms: RaffleTerms): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorIdentityId, RAFFLE_MODIFY_CAPABILITY);
  const before = await getRaffle(raffleId);
  if (!before) throw new Error(`Raffle ${raffleId} was not found`);
  const persisted = await withTransaction(async (client) => {
    const raffle = await modifyRaffleDomain(actorIdentityId, raffleId, terms, client);
    const publication = await publishEmission(client, { code: "raffle.modified", subject: raffle.raffleId });
    const activityDeclaration = raffle.drawingAtUnix !== before.drawingAtUnix
      ? await publishActivityDeclaration(client, { kind: "temporal-relevance-changed", activityKind: "raffle", activityId: raffle.raffleId })
      : null;
    return { raffle, publication, activityDeclaration };
  });
  await deliverEmission(persisted.publication);
  if (persisted.activityDeclaration) await deliverEmission(persisted.activityDeclaration);
  return persisted.raffle;
}

export async function openRaffleParticipation(actorIdentityId: string, raffleId: string): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorIdentityId, RAFFLE_STAGE_CAPABILITY);
  const persisted = await withTransaction(async (client) => {
    const raffle = await openRaffleParticipationDomain(actorIdentityId, raffleId, client);
    const publication = await publishEmission(client, { code: "raffle.opened", subject: raffle.raffleId });
    return { raffle, publication };
  });
  await deliverEmission(persisted.publication);
  return persisted.raffle;
}

export async function pauseRaffleParticipation(actorIdentityId: string, raffleId: string): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorIdentityId, RAFFLE_STAGE_CAPABILITY);
  const persisted = await withTransaction(async (client) => {
    const raffle = await pauseRaffleParticipationDomain(actorIdentityId, raffleId, client);
    const publication = await publishEmission(client, { code: "raffle.paused", subject: raffle.raffleId });
    return { raffle, publication };
  });
  await deliverEmission(persisted.publication);
  return persisted.raffle;
}

export async function resumeRaffleParticipation(actorIdentityId: string, raffleId: string): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorIdentityId, RAFFLE_STAGE_CAPABILITY);
  const persisted = await withTransaction(async (client) => {
    const raffle = await resumeRaffleParticipationDomain(actorIdentityId, raffleId, client);
    const publication = await publishEmission(client, { code: "raffle.resumed", subject: raffle.raffleId });
    return { raffle, publication };
  });
  await deliverEmission(persisted.publication);
  return persisted.raffle;
}

export async function cancelRaffle(actorIdentityId: string, raffleId: string): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorIdentityId, RAFFLE_STAGE_CAPABILITY);
  const persisted = await withTransaction(async (client) => {
    const raffle = await cancelRaffleDomain(actorIdentityId, raffleId, client);
    const approvedEntryCount = await approvedRaffleEntryCount(client, raffle.raffleId);
    await freezeActivityOccurrence(client, {
      activityKind: "raffle",
      activityId: raffle.raffleId,
      ...raffleOccurrenceProjection(raffle, approvedEntryCount, false),
    }, raffle.concludedAtUnix!);
    const publication = await publishEmission(client, { code: "raffle.cancelled", subject: raffle.raffleId });
    const activityDeclaration = await publishActivityDeclaration(client, { kind: "temporal-relevance-changed", activityKind: "raffle", activityId: raffle.raffleId });
    return { raffle, publication, activityDeclaration };
  });
  await deliverEmission(persisted.publication);
  await deliverEmission(persisted.activityDeclaration);
  return persisted.raffle;
}

export async function raffleParticipationOfferWorkspace(raffle: Raffle, actorIdentityId: string) {
  return raffleParticipationOfferWorkspaceDomain(raffle, { kind: "native", reference: actorIdentityId });
}

export async function establishRaffleClaimFromParticipationContext(
  claimantGuildieId: string,
  raffleId: string,
  context: Readonly<Record<string, unknown>>,
): Promise<RaffleClaim> {
  return establishRaffleClaimFromParticipationContextDomain(claimantGuildieId, raffleId, context);
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

export async function establishDeclaredRaffleClaim(discordActorReference: string, raffleId: string, designation: string, entries: number): Promise<string> {
  return establishDeclaredRaffleClaimDomain({ kind: "external", reference: discordActorReference }, raffleId, designation, entries);
}

export async function revokeRaffleClaim(claimantGuildieId: string, claimId: string): Promise<void> {
  await revokeRaffleClaimDomain(claimantGuildieId, claimId);
}

export async function revokeExternalRaffleClaim(discordActorReference: string, claimId: string): Promise<void> {
  await revokeRaffleClaimForActorDomain({ kind: "external", reference: discordActorReference }, claimId);
}

export async function approveRaffleClaim(actorIdentityId: string, claimId: string): Promise<void> {
  await requireGuildCapabilityOrOperator(actorIdentityId, RAFFLE_CLAIMS_CAPABILITY);
  await approveRaffleClaimDomain(actorIdentityId, claimId);
}

export async function denyRaffleClaim(actorIdentityId: string, claimId: string, reasonInput: string): Promise<void> {
  await requireGuildCapabilityOrOperator(actorIdentityId, RAFFLE_CLAIMS_CAPABILITY);
  await denyRaffleClaimDomain(actorIdentityId, claimId, reasonInput);
}

export async function drawRaffle(actorIdentityId: string, raffleId: string): Promise<Raffle> {
  await requireGuildCapabilityOrOperator(actorIdentityId, RAFFLE_DRAW_CAPABILITY);
  const persisted = await withTransaction(async (client) => {
    const raffle = await drawRaffleDomain(actorIdentityId, raffleId, client);
    const approvedEntryCount = await approvedRaffleEntryCount(client, raffle.raffleId);
    await freezeActivityOccurrence(client, {
      activityKind: "raffle",
      activityId: raffle.raffleId,
      ...raffleOccurrenceProjection(raffle, approvedEntryCount, false),
    }, raffle.concludedAtUnix!);
    const publication = await publishEmission(client, { code: "raffle.concluded", subject: raffle.raffleId });
    return { raffle, publication };
  });
  const concluded = persisted.raffle;
  if (concluded.conclusion === "drawn" && !concluded.winningParticipationOfferId) {
    console.error(`[raffle] drawn Raffle ${concluded.raffleId} is missing its winning Participation Offer`);
    await publishRaffleOperationalException({
      operation: "raffle.draw",
      actorIdentityId,
      summary: "Drawn Raffle is missing its winning Participation Offer.",
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
