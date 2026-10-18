import { deliverEmission, publishEmission } from "../../emissions/registry.js";
import type { ActivitySharedValue } from "../../core/activity/registry.js";
import { randomInt, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  activityParticipationOfferByProcedureReference,
  activityParticipationOffersForActivity,
  closeActivityParticipationOffer,
  closeOutstandingActivityParticipationOffers,
  constructActivityParticipationOffer,
  participationOfferWorkspace,
  establishActivityParticipation,
  revokeActivityParticipationOffer,
  type ActivityParticipationActor,
  type ActivityParticipationOfferContract,
  type ParticipationOfferWorkspace,
} from "../../core/activity/participation.js";
import { requireOperationalInstallationGuildBinding } from "../../core/installation/guild-binding.js";
import { characterByRecordId } from "../../core/identity/controlled-characters.js";
import { pool, withTransaction } from "../../db.js";

export const RAFFLE_OPERATIONAL_BUFFER_SECONDS = 60 * 60;

export type RaffleConclusion = "drawn" | "operator_cancelled" | "no_participation" | null;
export type RafflePrizeKind = "gold" | "item" | "other";
export type RaffleClaimResolution = "approved" | "denied" | "revoked" | null;

export type RaffleTerms = {
  title?: string | null;
  drawingAtUnix: number;
  entryPriceGold: number;
  prizeKind: RafflePrizeKind;
  winnerPercentage?: number | null;
  prizeDescription?: string | null;
};

export type Raffle = {
  raffleId: string;
  guildId: string;
  conclusion: RaffleConclusion;
  title: string | null;
  drawingAtUnix: number;
  entryPriceGold: string;
  prizeKind: RafflePrizeKind;
  winnerPercentage: number | null;
  prizeDescription: string | null;
  createdByGuildieId: string;
  createdAtUnix: number;
  updatedByGuildieId: string | null;
  updatedAtUnix: number | null;
  openedByGuildieId: string | null;
  openedAtUnix: number | null;
  participationPausedByGuildieId: string | null;
  participationPausedAtUnix: number | null;
  participationResumedByGuildieId: string | null;
  participationResumedAtUnix: number | null;
  concludedByGuildieId: string | null;
  concludedAtUnix: number | null;
  totalEntries: number | null;
  selectedIndex: number | null;
  winningParticipationOfferId: string | null;
};

export type RaffleClaim = {
  claimId: string;
  raffleId: string;
  claimantGuildieId: string;
  characterRecordId: string;
  characterId: string;
  realmId: string;
  characterName: string;
  requestedEntryCount: number;
  promisedGoldValue: string;
  createdAtUnix: number;
  resolutionKind: RaffleClaimResolution;
  approvedByGuildieId: string | null;
  approvedAtUnix: number | null;
  deniedByGuildieId: string | null;
  deniedAtUnix: number | null;
  denialReason: string | null;
  revokedByGuildieId: string | null;
  revokedAtUnix: number | null;
};

export class RaffleRuleError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number = 409) {
    super(message);
    this.name = "RaffleRuleError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

async function withOptionalTransaction<T>(
  client: PoolClient | null,
  operation: (transactionClient: PoolClient) => Promise<T>,
): Promise<T> {
  return client ? operation(client) : withTransaction(operation);
}

export function raffleParticipationCutoffUnix(drawingAtUnix: number): number {
  return drawingAtUnix - RAFFLE_OPERATIONAL_BUFFER_SECONDS;
}

function requireFullOperationalBuffer(drawingAtUnix: number): void {
  if (drawingAtUnix - unixNow() < RAFFLE_OPERATIONAL_BUFFER_SECONDS) {
    throw new RaffleRuleError("operational_buffer_required", "Raffle drawing time must preserve the full operational buffer");
  }
}

export function raffleParticipationIsOpen(raffle: Pick<Raffle, "conclusion" | "openedAtUnix" | "participationPausedAtUnix" | "participationResumedAtUnix" | "drawingAtUnix">, atUnix: number = unixNow()): boolean {
  return raffle.conclusion === null
    && raffle.openedAtUnix !== null
    && (raffle.participationPausedAtUnix === null || raffle.participationResumedAtUnix !== null)
    && atUnix < raffleParticipationCutoffUnix(raffle.drawingAtUnix);
}

function validateTerms(terms: RaffleTerms): Required<Omit<RaffleTerms, "title" | "winnerPercentage" | "prizeDescription">> & {
  title: string | null;
  winnerPercentage: number | null;
  prizeDescription: string | null;
} {
  if (!Number.isInteger(terms.drawingAtUnix) || terms.drawingAtUnix < 0) {
    throw new RaffleRuleError("invalid_drawing_time", "Drawing time must be a non-negative Unix timestamp", 400);
  }
  if (!Number.isSafeInteger(terms.entryPriceGold) || terms.entryPriceGold <= 0) {
    throw new RaffleRuleError("invalid_entry_price", "Entry price must be a positive integer amount of gold", 400);
  }
  if (!["gold", "item", "other"].includes(terms.prizeKind)) {
    throw new RaffleRuleError("invalid_prize_kind", "Prize type must be gold, item, or other", 400);
  }

  const title = terms.title?.trim() || null;
  const winnerPercentage = terms.winnerPercentage ?? null;
  const prizeDescription = terms.prizeDescription?.trim() || null;
  if (terms.prizeKind === "gold") {
    if (typeof winnerPercentage !== "number" || !Number.isInteger(winnerPercentage) || winnerPercentage < 1 || winnerPercentage > 100) {
      throw new RaffleRuleError("invalid_winner_percentage", "Gold raffle prize percentage must be an integer from 1 through 100", 400);
    }
    if (prizeDescription !== null) throw new RaffleRuleError("prize_description_not_applicable", "Gold raffle prizes are defined by winner percentage", 400);
  } else {
    if (winnerPercentage !== null) throw new RaffleRuleError("winner_percentage_not_applicable", "Winner percentage is only defined for gold prizes", 400);
    if (!prizeDescription) throw new RaffleRuleError("prize_description_required", "Item and other prizes require a description", 400);
  }
  return { title, drawingAtUnix: terms.drawingAtUnix, entryPriceGold: terms.entryPriceGold, prizeKind: terms.prizeKind, winnerPercentage, prizeDescription };
}

function nullableNumber(value: unknown): number | null { return value == null ? null : Number(value); }
function nullableString(value: unknown): string | null { return value == null ? null : String(value); }

function mapRaffle(row: Record<string, unknown>): Raffle {
  return {
    raffleId: String(row.raffle_id),
    guildId: String(row.guild_id),
    conclusion: row.conclusion as RaffleConclusion,
    title: nullableString(row.title),
    drawingAtUnix: Number(row.drawing_at_unix),
    entryPriceGold: String(row.entry_price_gold),
    prizeKind: row.prize_kind as RafflePrizeKind,
    winnerPercentage: nullableNumber(row.winner_percentage),
    prizeDescription: nullableString(row.prize_description),
    createdByGuildieId: String(row.created_by_identity_id),
    createdAtUnix: Number(row.created_at_unix),
    updatedByGuildieId: nullableString(row.updated_by_identity_id),
    updatedAtUnix: nullableNumber(row.updated_at_unix),
    openedByGuildieId: nullableString(row.opened_by_identity_id),
    openedAtUnix: nullableNumber(row.opened_at_unix),
    participationPausedByGuildieId: nullableString(row.participation_paused_by_identity_id),
    participationPausedAtUnix: nullableNumber(row.participation_paused_at_unix),
    participationResumedByGuildieId: nullableString(row.participation_resumed_by_identity_id),
    participationResumedAtUnix: nullableNumber(row.participation_resumed_at_unix),
    concludedByGuildieId: nullableString(row.concluded_by_identity_id),
    concludedAtUnix: nullableNumber(row.concluded_at_unix),
    totalEntries: nullableNumber(row.total_entries),
    selectedIndex: nullableNumber(row.selected_index),
    winningParticipationOfferId: nullableString(row.winning_participation_offer_id),
  };
}


async function lockedRaffle(client: PoolClient, raffleId: string): Promise<Record<string, unknown>> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  const result = await client.query("SELECT * FROM raffles WHERE raffle_id = $1 AND guild_id = $2 FOR UPDATE", [raffleId, guildId]);
  if (!result.rowCount) throw new RaffleRuleError("raffle_not_found", "Raffle was not found", 404);
  return result.rows[0] as Record<string, unknown>;
}

async function lockedClaim(client: PoolClient, claimId: string): Promise<Record<string, unknown>> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  const result = await client.query(
    `SELECT rc.*, r.conclusion AS raffle_conclusion
       FROM raffle_claims rc
       JOIN raffles r ON r.raffle_id = rc.raffle_id
      WHERE rc.claim_id = $1 AND r.guild_id = $2
      FOR UPDATE OF rc, r`,
    [claimId, guildId],
  );
  if (!result.rowCount) throw new RaffleRuleError("claim_not_found", "Raffle claim was not found", 404);
  return result.rows[0] as Record<string, unknown>;
}

export async function establishRaffle(actorGuildieId: string, termsInput: RaffleTerms, client: PoolClient | null = null): Promise<Raffle> {
  const terms = validateTerms(termsInput);
  requireFullOperationalBuffer(terms.drawingAtUnix);
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  const result = await (client ?? pool).query(
    `INSERT INTO raffles (
       guild_id, title, drawing_at_unix, entry_price_gold, prize_kind,
       winner_percentage, prize_description, created_by_identity_id, created_at_unix
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [guildId, terms.title, terms.drawingAtUnix, String(terms.entryPriceGold), terms.prizeKind, terms.winnerPercentage, terms.prizeDescription, actorGuildieId, unixNow()],
  );
  return mapRaffle(result.rows[0] as Record<string, unknown>);
}

export async function modifyRaffle(actorGuildieId: string, raffleId: string, termsInput: RaffleTerms, client: PoolClient | null = null): Promise<Raffle> {
  const terms = validateTerms(termsInput);
  return withOptionalTransaction(client, async (transactionClient) => {
    const raffle = await lockedRaffle(transactionClient, raffleId);
    if (raffle.conclusion !== null) throw new RaffleRuleError("raffle_concluded", "A concluded Raffle cannot be modified");
    if (raffle.opened_at_unix !== null) throw new RaffleRuleError("raffle_terms_locked", "Raffle terms are locked once participation has opened");
    requireFullOperationalBuffer(terms.drawingAtUnix);
    const result = await transactionClient.query(
      `UPDATE raffles SET title=$2, drawing_at_unix=$3, entry_price_gold=$4, prize_kind=$5,
       winner_percentage=$6, prize_description=$7, updated_by_identity_id=$8, updated_at_unix=$9
       WHERE raffle_id=$1 RETURNING *`,
      [raffleId, terms.title, terms.drawingAtUnix, String(terms.entryPriceGold), terms.prizeKind, terms.winnerPercentage, terms.prizeDescription, actorGuildieId, unixNow()],
    );
    return mapRaffle(result.rows[0] as Record<string, unknown>);
  });
}

export async function openRaffleParticipation(actorGuildieId: string, raffleId: string, client: PoolClient | null = null): Promise<Raffle> {
  return withOptionalTransaction(client, async (transactionClient) => {
    const raffle = await lockedRaffle(transactionClient, raffleId);
    if (raffle.conclusion !== null) throw new RaffleRuleError("raffle_concluded", "A concluded Raffle cannot open participation");
    if (raffle.opened_at_unix !== null) throw new RaffleRuleError("participation_already_opened", "Raffle participation has already been opened");
    if (!raffleParticipationIsOpen({ conclusion: null, openedAtUnix: unixNow(), participationPausedAtUnix: null, participationResumedAtUnix: null, drawingAtUnix: Number(raffle.drawing_at_unix) })) {
      throw new RaffleRuleError("participation_freeze_reached", "Raffle participation cannot open after the operational buffer begins");
    }
    const openedAtUnix = unixNow();
    const result = await transactionClient.query(
      "UPDATE raffles SET opened_by_identity_id=$2, opened_at_unix=$3 WHERE raffle_id=$1 RETURNING *",
      [raffleId, actorGuildieId, openedAtUnix],
    );
    return mapRaffle(result.rows[0] as Record<string, unknown>);
  });
}

export async function pauseRaffleParticipation(actorGuildieId: string, raffleId: string, client: PoolClient | null = null): Promise<Raffle> {
  return withOptionalTransaction(client, async (transactionClient) => {
    const raffle = await lockedRaffle(transactionClient, raffleId);
    if (raffle.conclusion !== null) throw new RaffleRuleError("raffle_concluded", "A concluded Raffle cannot change participation availability");
    if (raffle.opened_at_unix === null) throw new RaffleRuleError("participation_not_opened", "Raffle participation has not been opened");
    const current = mapRaffle(raffle);
    if (!raffleParticipationIsOpen(current)) return current;
    const pausedAtUnix = unixNow();
    const result = await transactionClient.query(
      `UPDATE raffles
          SET participation_paused_by_identity_id=$2, participation_paused_at_unix=$3,
              participation_resumed_by_identity_id=NULL, participation_resumed_at_unix=NULL
        WHERE raffle_id=$1 RETURNING *`,
      [raffleId, actorGuildieId, pausedAtUnix],
    );
    return mapRaffle(result.rows[0] as Record<string, unknown>);
  });
}

export async function resumeRaffleParticipation(actorGuildieId: string, raffleId: string, client: PoolClient | null = null): Promise<Raffle> {
  return withOptionalTransaction(client, async (transactionClient) => {
    const raffle = await lockedRaffle(transactionClient, raffleId);
    if (raffle.conclusion !== null) throw new RaffleRuleError("raffle_concluded", "A concluded Raffle cannot change participation availability");
    if (raffle.opened_at_unix === null) throw new RaffleRuleError("participation_not_opened", "Raffle participation has not been opened");
    if (raffle.participation_paused_at_unix === null || raffle.participation_resumed_at_unix !== null) return mapRaffle(raffle);
    const resumedAtUnix = unixNow();
    if (resumedAtUnix >= raffleParticipationCutoffUnix(Number(raffle.drawing_at_unix))) {
      throw new RaffleRuleError("participation_freeze_reached", "Raffle participation cannot resume after the operational buffer begins");
    }
    const result = await transactionClient.query(
      "UPDATE raffles SET participation_resumed_by_identity_id=$2, participation_resumed_at_unix=$3 WHERE raffle_id=$1 RETURNING *",
      [raffleId, actorGuildieId, resumedAtUnix],
    );
    return mapRaffle(result.rows[0] as Record<string, unknown>);
  });
}

export async function cancelRaffle(actorGuildieId: string, raffleId: string, client: PoolClient | null = null): Promise<Raffle> {
  return withOptionalTransaction(client, async (transactionClient) => {
    const raffle = await lockedRaffle(transactionClient, raffleId);
    if (raffle.conclusion !== null) throw new RaffleRuleError("raffle_already_concluded", "A concluded Raffle cannot be cancelled");
    const concludedAtUnix=unixNow();
    await closeOutstandingActivityParticipationOffers(transactionClient,{
      activityKind:"raffle",
      activityId:raffleId,
      closedAtUnix:concludedAtUnix,
    });
    const result = await transactionClient.query(
      "UPDATE raffles SET conclusion='operator_cancelled', concluded_by_identity_id=$2, concluded_at_unix=$3 WHERE raffle_id=$1 RETURNING *",
      [raffleId, actorGuildieId, concludedAtUnix],
    );
    return mapRaffle(result.rows[0] as Record<string, unknown>);
  });
}

const raffleClaimOfferContract: ActivityParticipationOfferContract = {
  context: [
    { name: "character", kind: "guild_character", allowMultiple: false },
    { name: "claim", kind: "integer", allowMultiple: false, greaterThan: 0 },
  ],
};

// External actors supply a character designation rather than a Character record.
// Keep the established native contract unchanged for existing web claims.
const declaredRaffleClaimOfferContract: ActivityParticipationOfferContract = {
  context: [
    { name: "character", kind: "string", allowMultiple: false, maxLength: 120 },
    { name: "claim", kind: "integer", allowMultiple: false, greaterThan: 0 },
  ],
};

export function raffleClaimOfferContractForActor(actor: ActivityParticipationActor): ActivityParticipationOfferContract {
  return actor.kind === "external" ? declaredRaffleClaimOfferContract : raffleClaimOfferContract;
}

export async function raffleParticipationOfferWorkspace(
  raffle: Raffle,
  actor: ActivityParticipationActor,
): Promise<ParticipationOfferWorkspace> {
  return participationOfferWorkspace({
    actor,
    eligibility: actor.kind === "external"
      ? { kind: "any" }
      : { kind: "guild_member_character", guildId: raffle.guildId },
    contract: raffleClaimOfferContractForActor(actor),
  });
}

export async function establishDeclaredRaffleClaim(actor: ActivityParticipationActor, raffleId: string, designation: string, entries: number): Promise<string> {
  if (actor.kind !== "external") throw new RaffleRuleError("external_actor_required", "An external actor is required", 403);
  const normalized = designation.trim();
  const separator = normalized.indexOf("-");
  if (separator < 1 || separator === normalized.length - 1 || normalized.length > 120) {
    throw new RaffleRuleError("invalid_character_designation", "Use Charactername-Realm", 400);
  }
  const persisted = await withTransaction(async (client) => {
    const row = await lockedRaffle(client, raffleId);
    if (!raffleParticipationIsOpen(mapRaffle(row))) throw new RaffleRuleError("participation_closed", "Raffle participation is closed");
    const claimId = randomUUID();
    const offeredAtUnix = unixNow();
    const offer = await constructActivityParticipationOffer(client, {
      activityKind: "raffle", activityId: raffleId, actor,
      eligibility: { kind: "any" }, contract: declaredRaffleClaimOfferContract,
      context: { character: normalized, claim: entries },
      procedureReference: claimId, offeredAtUnix,
    });
    const count = offer.context.find((item) => item.name === "claim")?.value;
    if (!count || Array.isArray(count) || (count as ActivitySharedValue).type !== "integer") {
      throw new Error("Raffle claim contract was not satisfied");
    }
    const value = count as Extract<ActivitySharedValue, { type: "integer" }>;
    const promisedGold = (BigInt(String(row.entry_price_gold)) * BigInt(value.value)).toString();
    await client.query(
      "INSERT INTO raffle_claims (claim_id, raffle_id, promised_gold_value, created_at_unix, participation_offer_id) VALUES ($1,$2,$3,$4,$5)",
      [claimId, raffleId, promisedGold, offeredAtUnix, offer.participationOfferId],
    );
    const publication = await publishEmission(client, { code: "raffle.claim.established", parent: raffleId, subject: claimId });
    return { value: claimId, publication };
  });
  await deliverEmission(persisted.publication);
  return persisted.value;
}

export async function establishRaffleClaimFromParticipationContext(
  claimantGuildieId: string,
  raffleId: string,
  context: Readonly<Record<string, unknown>>,
): Promise<RaffleClaim> {
  const persisted = await withTransaction(async (client) => {
    const raffleRow = await lockedRaffle(client, raffleId);
    const raffle = mapRaffle(raffleRow);
    if (!raffleParticipationIsOpen(raffle)) throw new RaffleRuleError("participation_closed", "Raffle participation is closed");

    const claimId = randomUUID();
    const offeredAtUnix = unixNow();
    const offer = await constructActivityParticipationOffer(client, {
      activityKind: "raffle",
      activityId: raffleId,
      actor: { kind: "native", reference: claimantGuildieId },
      eligibility: { kind: "guild_member_character", guildId: raffle.guildId },
      contract: raffleClaimOfferContract,
      context,
      procedureReference: claimId,
      offeredAtUnix,
    });

    const characterComponent = offer.context.find((item) => item.name === "character");
    const claimComponent = offer.context.find((item) => item.name === "claim");
    const characterValue = characterComponent?.value;
    const claimValue = claimComponent?.value;
    if (!characterValue || !claimValue || Array.isArray(characterValue) || Array.isArray(claimValue)) {
      throw new Error("Constructed Raffle Participation Offer does not satisfy its declared contract");
    }
    const singularCharacterValue = characterValue as ActivitySharedValue;
    const singularClaimValue = claimValue as ActivitySharedValue;
    if (singularCharacterValue.type !== "guild_character" || singularClaimValue.type !== "integer") {
      throw new Error("Constructed Raffle Participation Offer does not satisfy its declared contract");
    }

    const character = singularCharacterValue.value;
    const entryCount = singularClaimValue.value;
    const promisedGoldValue = BigInt(String(raffleRow.entry_price_gold)) * BigInt(entryCount);
    await client.query(
      `INSERT INTO raffle_claims (
         claim_id, raffle_id, promised_gold_value, created_at_unix, participation_offer_id
       ) VALUES ($1,$2,$3,$4,$5)`,
      [claimId, raffleId, promisedGoldValue.toString(), offeredAtUnix, offer.participationOfferId],
    );

    const publication = await publishEmission(client, { code: "raffle.claim.established", parent: raffleId, subject: claimId });
    return { value: {
      claimId,
      raffleId,
      claimantGuildieId: offer.actor.reference,
      characterRecordId: character.characterRecordId,
      characterId: character.characterId,
      realmId: character.realmId,
      characterName: character.name,
      requestedEntryCount: entryCount,
      promisedGoldValue: promisedGoldValue.toString(),
      createdAtUnix: offeredAtUnix,
      resolutionKind: null,
      approvedByGuildieId: null,
      approvedAtUnix: null,
      deniedByGuildieId: null,
      deniedAtUnix: null,
      denialReason: null,
      revokedByGuildieId: null,
      revokedAtUnix: null,
    }, publication };
  });
  await deliverEmission(persisted.publication);
  return persisted.value;
}

export async function establishRaffleClaim(claimantGuildieId: string, raffleId: string, realmId: string, characterId: string, requestedEntryCount: number): Promise<RaffleClaim> {
  const persisted = await withTransaction(async (client) => {
    const raffleRow = await lockedRaffle(client, raffleId);
    const raffle = mapRaffle(raffleRow);
    if (!raffleParticipationIsOpen(raffle)) throw new RaffleRuleError("participation_closed", "Raffle participation is closed");

    const claimId = randomUUID();
    const offeredAtUnix = unixNow();
    const offer = await constructActivityParticipationOffer(client, {
      activityKind: "raffle",
      activityId: raffleId,
      actor: { kind: "native", reference: claimantGuildieId },
      eligibility: { kind: "guild_member_character", guildId: raffle.guildId },
      contract: raffleClaimOfferContract,
      context: {
        character: { realmId, characterId },
        claim: requestedEntryCount,
      },
      procedureReference: claimId,
      offeredAtUnix,
    });

    const characterComponent = offer.context.find((item) => item.name === "character");
    const claimComponent = offer.context.find((item) => item.name === "claim");
    const characterValue = characterComponent?.value;
    const claimValue = claimComponent?.value;
    if (!characterValue || !claimValue || Array.isArray(characterValue) || Array.isArray(claimValue)) {
      throw new Error("Constructed Raffle Participation Offer does not satisfy its declared contract");
    }
    const singularCharacterValue = characterValue as ActivitySharedValue;
    const singularClaimValue = claimValue as ActivitySharedValue;
    if (singularCharacterValue.type !== "guild_character" || singularClaimValue.type !== "integer") {
      throw new Error("Constructed Raffle Participation Offer does not satisfy its declared contract");
    }

    const character = singularCharacterValue.value;
    const entryCount = singularClaimValue.value;
    const promisedGoldValue = BigInt(String(raffleRow.entry_price_gold)) * BigInt(entryCount);
    await client.query(
      `INSERT INTO raffle_claims (
         claim_id, raffle_id, promised_gold_value, created_at_unix, participation_offer_id
       ) VALUES ($1,$2,$3,$4,$5)`,
      [claimId, raffleId, promisedGoldValue.toString(), offeredAtUnix, offer.participationOfferId],
    );

    const publication = await publishEmission(client, { code: "raffle.claim.established", parent: raffleId, subject: claimId });
    return { value: {
      claimId,
      raffleId,
      claimantGuildieId: offer.actor.reference,
      characterRecordId: character.characterRecordId,
      characterId: character.characterId,
      realmId: character.realmId,
      characterName: character.name,
      requestedEntryCount: entryCount,
      promisedGoldValue: promisedGoldValue.toString(),
      createdAtUnix: offeredAtUnix,
      resolutionKind: null,
      approvedByGuildieId: null,
      approvedAtUnix: null,
      deniedByGuildieId: null,
      deniedAtUnix: null,
      denialReason: null,
      revokedByGuildieId: null,
      revokedAtUnix: null,
    }, publication };
  });
  await deliverEmission(persisted.publication);
  return persisted.value;
}

export async function revokeRaffleClaimForActor(actor: ActivityParticipationActor, claimId: string): Promise<void> {
  const publication = await withTransaction(async (client) => {
    const claim = await lockedClaim(client, claimId);
    const offer = await activityParticipationOfferByProcedureReference(client, {
      activityKind: "raffle",
      activityId: String(claim.raffle_id),
      procedureReference: claimId,
    });
    if (!offer || offer.actor.kind !== actor.kind || offer.actor.reference !== actor.reference) {
      throw new RaffleRuleError("claim_not_owned", "Only the claim owner may withdraw it", 403);
    }
    if (claim.raffle_conclusion !== null) throw new RaffleRuleError("raffle_concluded", "Claims cannot be revoked after the Raffle concludes");
    if (claim.resolution_kind !== null) throw new RaffleRuleError("claim_already_resolved", "Only an unresolved claim can be revoked");

    const revokedAtUnix = unixNow();
    await revokeActivityParticipationOffer(client, {
      activityKind: "raffle",
      activityId: String(claim.raffle_id),
      actor,
      procedureReference: claimId,
      revokedAtUnix,
    });
    await client.query(
      "UPDATE raffle_claims SET resolution_kind='revoked', revoked_by_identity_id=$2, revoked_at_unix=$3 WHERE claim_id=$1",
      [claimId, actor.kind === "native" ? actor.reference : null, revokedAtUnix],
    );
    return publishEmission(client, { code: "raffle.claim.revoked", parent: String(claim.raffle_id), subject: claimId });
  });
  await deliverEmission(publication);
}

export async function revokeRaffleClaim(claimantGuildieId: string, claimId: string): Promise<void> {
  return revokeRaffleClaimForActor({ kind: "native", reference: claimantGuildieId }, claimId);
}

export async function approveRaffleClaim(actorGuildieId:string, claimId:string):Promise<void> {
  const publication = await withTransaction(async(client)=>{
    const claim=await lockedClaim(client,claimId);
    if(claim.raffle_conclusion!==null) throw new RaffleRuleError("raffle_concluded","Claims can only be adjudicated before the Raffle concludes");
    if(claim.resolution_kind!==null) throw new RaffleRuleError("claim_already_resolved","Only an unresolved claim can be approved");
    const approvedAtUnix=unixNow();
    await client.query("UPDATE raffle_claims SET resolution_kind='approved', approved_by_identity_id=$2, approved_at_unix=$3 WHERE claim_id=$1",[claimId,actorGuildieId,approvedAtUnix]);
    const offer=await activityParticipationOfferByProcedureReference(client,{
      activityKind:"raffle",
      activityId:String(claim.raffle_id),
      procedureReference:claimId,
    });
    if(!offer) throw new Error("Raffle claim Participation Offer was not found");
    await establishActivityParticipation(client,{
      activityKind:"raffle",
      activityId:String(claim.raffle_id),
      party:offer.actor,
      procedureReference:claimId,
      participationOfferId:offer.participationOfferId,
      establishedAtUnix:approvedAtUnix,
    });
    return publishEmission(client, { code: "raffle.claim.approved", parent: String(claim.raffle_id), subject: claimId });
  });
  await deliverEmission(publication);
}

export async function denyRaffleClaim(actorGuildieId:string, claimId:string, reasonInput:string):Promise<void> {
  const reason=reasonInput.trim();
  if(!reason) throw new RaffleRuleError("denial_reason_required","A denial reason is required",400);
  const publication = await withTransaction(async(client)=>{
    const claim=await lockedClaim(client,claimId);
    if(claim.raffle_conclusion!==null) throw new RaffleRuleError("raffle_concluded","Claims can only be adjudicated before the Raffle concludes");
    if(claim.resolution_kind!==null) throw new RaffleRuleError("claim_already_resolved","Only an unresolved claim can be denied");
    const deniedAtUnix=unixNow();
    await client.query("UPDATE raffle_claims SET resolution_kind='denied', denied_by_identity_id=$2, denied_at_unix=$3, denial_reason=$4 WHERE claim_id=$1",[claimId,actorGuildieId,deniedAtUnix,reason]);
    await closeActivityParticipationOffer(client,{
      activityKind:"raffle",
      activityId:String(claim.raffle_id),
      procedureReference:claimId,
      closedAtUnix:deniedAtUnix,
    });
    return publishEmission(client, { code: "raffle.claim.denied", parent: String(claim.raffle_id), subject: claimId });
  });
  await deliverEmission(publication);
}

export async function approvedRaffleEntryCount(client: PoolClient, raffleId: string): Promise<number> {
  const approved = await client.query<{ claim_id: string }>(
    "SELECT claim_id FROM raffle_claims WHERE raffle_id=$1 AND resolution_kind='approved'",
    [raffleId],
  );
  const offers = await activityParticipationOffersForActivity(client, {
    activityKind: "raffle",
    activityId: raffleId,
    procedureReferences: approved.rows.map((row) => String(row.claim_id)),
  });
  let count = 0;
  for (const offer of offers) {
    const component = offer.context.find((candidate) => candidate.name === "claim")?.value;
    if (Array.isArray(component)) throw new Error("Raffle claim Participation Offer does not satisfy its declared contract");
    const value = component as ActivitySharedValue | undefined;
    if (!value || value.type !== "integer") throw new Error("Raffle claim Participation Offer does not satisfy its declared contract");
    count += value.value;
  }
  return count;
}

export async function drawRaffle(actorGuildieId:string, raffleId:string, client:PoolClient|null=null):Promise<Raffle> {
  return withOptionalTransaction(client,async(transactionClient)=>{
    const raffle=await lockedRaffle(transactionClient,raffleId);
    if(raffle.conclusion!==null) throw new RaffleRuleError("raffle_already_concluded","A concluded Raffle cannot be drawn");
    if(raffle.opened_at_unix===null) throw new RaffleRuleError("participation_not_opened","A Raffle must open participation before it can be drawn");
    const now=unixNow();
    if(now<Number(raffle.drawing_at_unix)) throw new RaffleRuleError("drawing_not_reached","A Raffle cannot be drawn before its declared drawing time");

    const pending=await transactionClient.query<{count:string}>("SELECT count(*)::text AS count FROM raffle_claims WHERE raffle_id=$1 AND resolution_kind IS NULL",[raffleId]);
    if(Number(pending.rows[0].count)>0) throw new RaffleRuleError("unresolved_claims","All claims must be approved, denied, or revoked before the Raffle can be drawn");

    const approved=await transactionClient.query<{claim_id:string}>(
      "SELECT claim_id FROM raffle_claims WHERE raffle_id=$1 AND resolution_kind='approved' ORDER BY created_at_unix ASC, claim_id ASC",[raffleId]);
    const population:string[]=[];
    for(const claim of approved.rows) {
      const offer=await activityParticipationOfferByProcedureReference(transactionClient,{
        activityKind:"raffle",
        activityId:raffleId,
        procedureReference:claim.claim_id,
      });
      if(!offer) throw new Error("Approved Raffle claim Participation Offer was not found");
      const claimComponent=offer.context.find((item)=>item.name==="claim");
      const claimValue=claimComponent?.value;
      if(Array.isArray(claimValue)) throw new Error("Raffle claim Participation Offer does not satisfy its declared contract");
      const singularClaimValue=claimValue as ActivitySharedValue|undefined;
      if(!singularClaimValue || singularClaimValue.type!=="integer") {
        throw new Error("Raffle claim Participation Offer does not satisfy its declared contract");
      }
      for(let index=0;index<singularClaimValue.value;index+=1) population.push(offer.participationOfferId);
    }

    if(population.length===0){
      const result=await transactionClient.query(
        "UPDATE raffles SET conclusion='no_participation', concluded_by_identity_id=$2, concluded_at_unix=$3 WHERE raffle_id=$1 RETURNING *",
        [raffleId,actorGuildieId,now]);
      return mapRaffle(result.rows[0] as Record<string,unknown>);
    }
    const selectedIndex=randomInt(population.length);
    const winningParticipationOfferId=population[selectedIndex];
    const result=await transactionClient.query(
      `UPDATE raffles SET conclusion='drawn', concluded_by_identity_id=$2, concluded_at_unix=$3,
       total_entries=$4, selected_index=$5, winning_participation_offer_id=$6 WHERE raffle_id=$1 RETURNING *`,
      [raffleId,actorGuildieId,now,population.length,selectedIndex,winningParticipationOfferId]);
    return mapRaffle(result.rows[0] as Record<string,unknown>);
  });
}

export async function raffle(raffleId:string):Promise<Raffle|null> {
  const guildId=(await requireOperationalInstallationGuildBinding()).guildId;
  const result=await pool.query("SELECT * FROM raffles WHERE raffle_id=$1 AND guild_id=$2",[raffleId,guildId]);
  return result.rowCount?mapRaffle(result.rows[0] as Record<string,unknown>):null;
}

export async function raffleClaims(raffleId:string):Promise<RaffleClaim[]> {
  const guildId=(await requireOperationalInstallationGuildBinding()).guildId;
  const result=await pool.query<Record<string,unknown>>(
    `SELECT rc.claim_id,rc.raffle_id,rc.promised_gold_value,rc.created_at_unix,
       rc.resolution_kind,rc.approved_by_identity_id,rc.approved_at_unix,
       rc.denied_by_identity_id,rc.denied_at_unix,rc.denial_reason,
       rc.revoked_by_identity_id,rc.revoked_at_unix
       FROM raffle_claims rc
       JOIN raffles r ON r.raffle_id=rc.raffle_id AND r.guild_id=$2
      WHERE rc.raffle_id=$1 ORDER BY rc.created_at_unix ASC,rc.claim_id ASC`,
    [raffleId,guildId],
  );
  if(result.rows.length===0) return [];

  const client=await pool.connect();
  try {
    const claimIds=result.rows.map((row)=>String(row.claim_id));
    const offers=await activityParticipationOffersForActivity(client,{
      activityKind:"raffle",
      activityId:raffleId,
      procedureReferences:claimIds,
    });
    const offersByClaimId=new Map(offers.map((offer)=>[offer.procedureReference,offer]));
    const claims:RaffleClaim[]=[];
    for(const row of result.rows){
      const claimId=String(row.claim_id);
      const offer=offersByClaimId.get(claimId);
      if(!offer || offer.actor.kind!=="native") throw new Error(`Raffle claim ${claimId} is missing its Participation Offer`);
      const characterValue=offer.context.find((item)=>item.name==="character")?.value;
      const claimValue=offer.context.find((item)=>item.name==="claim")?.value;
      if(Array.isArray(characterValue)||Array.isArray(claimValue)) throw new Error(`Raffle claim ${claimId} Participation Offer does not satisfy its declared contract`);
      const characterComponent=characterValue as ActivitySharedValue|undefined;
      const claimComponent=claimValue as ActivitySharedValue|undefined;
      if(characterComponent?.type!=="guild_character"||claimComponent?.type!=="integer") throw new Error(`Raffle claim ${claimId} Participation Offer does not satisfy its declared contract`);
      const character=characterComponent.value;
      const recognizedCharacter=await characterByRecordId(character.characterRecordId);
      claims.push({
        claimId,
        raffleId:String(row.raffle_id),
        claimantGuildieId:offer.actor.reference,
        characterRecordId:character.characterRecordId,
        characterId:character.characterId,
        realmId:character.realmId,
        characterName:recognizedCharacter?.name ?? character.name,
        requestedEntryCount:claimComponent.value,
        promisedGoldValue:String(row.promised_gold_value),
        createdAtUnix:Number(row.created_at_unix),
        resolutionKind:row.resolution_kind as RaffleClaimResolution,
        approvedByGuildieId:nullableString(row.approved_by_identity_id),
        approvedAtUnix:nullableNumber(row.approved_at_unix),
        deniedByGuildieId:nullableString(row.denied_by_identity_id),
        deniedAtUnix:nullableNumber(row.denied_at_unix),
        denialReason:nullableString(row.denial_reason),
        revokedByGuildieId:nullableString(row.revoked_by_identity_id),
        revokedAtUnix:nullableNumber(row.revoked_at_unix),
      });
    }
    return claims;
  } finally {
    client.release();
  }
}
