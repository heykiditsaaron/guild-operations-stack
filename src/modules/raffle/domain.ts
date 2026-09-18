import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { config } from "../../config.js";
import { pool, withTransaction } from "../../db.js";

export const RAFFLE_PARTICIPATION_FREEZE_SECONDS = 60 * 60;

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
  participationClosedByGuildieId: string | null;
  participationClosedAtUnix: number | null;
  concludedByGuildieId: string | null;
  concludedAtUnix: number | null;
  totalEntries: number | null;
  selectedIndex: number | null;
  winningClaimId: string | null;
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
  return drawingAtUnix - RAFFLE_PARTICIPATION_FREEZE_SECONDS;
}

export function raffleParticipationIsOpen(raffle: Pick<Raffle, "conclusion" | "openedAtUnix" | "participationClosedAtUnix" | "drawingAtUnix">, atUnix: number = unixNow()): boolean {
  return raffle.conclusion === null
    && raffle.openedAtUnix !== null
    && raffle.participationClosedAtUnix === null
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
    createdByGuildieId: String(row.created_by_guildie_id),
    createdAtUnix: Number(row.created_at_unix),
    updatedByGuildieId: nullableString(row.updated_by_guildie_id),
    updatedAtUnix: nullableNumber(row.updated_at_unix),
    openedByGuildieId: nullableString(row.opened_by_guildie_id),
    openedAtUnix: nullableNumber(row.opened_at_unix),
    participationClosedByGuildieId: nullableString(row.participation_closed_by_guildie_id),
    participationClosedAtUnix: nullableNumber(row.participation_closed_at_unix),
    concludedByGuildieId: nullableString(row.concluded_by_guildie_id),
    concludedAtUnix: nullableNumber(row.concluded_at_unix),
    totalEntries: nullableNumber(row.total_entries),
    selectedIndex: nullableNumber(row.selected_index),
    winningClaimId: nullableString(row.winning_claim_id),
  };
}

function mapClaim(row: Record<string, unknown>): RaffleClaim {
  return {
    claimId: String(row.claim_id),
    raffleId: String(row.raffle_id),
    claimantGuildieId: String(row.claimant_guildie_id),
    characterRecordId: String(row.character_record_id),
    characterId: String(row.character_id),
    realmId: String(row.realm_id),
    characterName: String(row.character_name),
    requestedEntryCount: Number(row.requested_entry_count),
    promisedGoldValue: String(row.promised_gold_value),
    createdAtUnix: Number(row.created_at_unix),
    resolutionKind: row.resolution_kind as RaffleClaimResolution,
    approvedByGuildieId: nullableString(row.approved_by_guildie_id),
    approvedAtUnix: nullableNumber(row.approved_at_unix),
    deniedByGuildieId: nullableString(row.denied_by_guildie_id),
    deniedAtUnix: nullableNumber(row.denied_at_unix),
    denialReason: nullableString(row.denial_reason),
    revokedByGuildieId: nullableString(row.revoked_by_guildie_id),
    revokedAtUnix: nullableNumber(row.revoked_at_unix),
  };
}

async function lockedRaffle(client: PoolClient, raffleId: string): Promise<Record<string, unknown>> {
  const result = await client.query("SELECT * FROM raffles WHERE raffle_id = $1 AND guild_id = $2 FOR UPDATE", [raffleId, config.guild.id]);
  if (!result.rowCount) throw new RaffleRuleError("raffle_not_found", "Raffle was not found", 404);
  return result.rows[0] as Record<string, unknown>;
}

async function lockedClaim(client: PoolClient, claimId: string): Promise<Record<string, unknown>> {
  const result = await client.query(
    `SELECT rc.*, r.conclusion AS raffle_conclusion
       FROM raffle_claims rc
       JOIN raffles r ON r.raffle_id = rc.raffle_id
      WHERE rc.claim_id = $1 AND r.guild_id = $2
      FOR UPDATE OF rc, r`,
    [claimId, config.guild.id],
  );
  if (!result.rowCount) throw new RaffleRuleError("claim_not_found", "Raffle claim was not found", 404);
  return result.rows[0] as Record<string, unknown>;
}

export async function establishRaffle(actorGuildieId: string, termsInput: RaffleTerms, client: PoolClient | null = null): Promise<Raffle> {
  const terms = validateTerms(termsInput);
  const result = await (client ?? pool).query(
    `INSERT INTO raffles (
       guild_id, title, drawing_at_unix, entry_price_gold, prize_kind,
       winner_percentage, prize_description, created_by_guildie_id, created_at_unix
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [config.guild.id, terms.title, terms.drawingAtUnix, String(terms.entryPriceGold), terms.prizeKind, terms.winnerPercentage, terms.prizeDescription, actorGuildieId, unixNow()],
  );
  return mapRaffle(result.rows[0] as Record<string, unknown>);
}

export async function modifyRaffle(actorGuildieId: string, raffleId: string, termsInput: RaffleTerms, client: PoolClient | null = null): Promise<Raffle> {
  const terms = validateTerms(termsInput);
  return withOptionalTransaction(client, async (transactionClient) => {
    const raffle = await lockedRaffle(transactionClient, raffleId);
    if (raffle.conclusion !== null) throw new RaffleRuleError("raffle_concluded", "A concluded Raffle cannot be modified");
    if (raffle.opened_at_unix !== null) throw new RaffleRuleError("raffle_terms_locked", "Raffle terms are locked once participation has opened");
    const result = await transactionClient.query(
      `UPDATE raffles SET title=$2, drawing_at_unix=$3, entry_price_gold=$4, prize_kind=$5,
       winner_percentage=$6, prize_description=$7, updated_by_guildie_id=$8, updated_at_unix=$9
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
    if (!raffleParticipationIsOpen({ conclusion: null, openedAtUnix: unixNow(), participationClosedAtUnix: null, drawingAtUnix: Number(raffle.drawing_at_unix) })) {
      throw new RaffleRuleError("participation_freeze_reached", "Raffle participation cannot open after the one-hour pre-drawing freeze begins");
    }
    const openedAtUnix = unixNow();
    const result = await transactionClient.query(
      "UPDATE raffles SET opened_by_guildie_id=$2, opened_at_unix=$3 WHERE raffle_id=$1 RETURNING *",
      [raffleId, actorGuildieId, openedAtUnix],
    );
    return mapRaffle(result.rows[0] as Record<string, unknown>);
  });
}

export async function closeRaffleParticipation(actorGuildieId: string, raffleId: string, client: PoolClient | null = null): Promise<Raffle> {
  return withOptionalTransaction(client, async (transactionClient) => {
    const raffle = await lockedRaffle(transactionClient, raffleId);
    if (raffle.conclusion !== null) throw new RaffleRuleError("raffle_concluded", "A concluded Raffle cannot change participation availability");
    if (raffle.opened_at_unix === null) throw new RaffleRuleError("participation_not_opened", "Raffle participation has not been opened");
    if (raffle.participation_closed_at_unix !== null) return mapRaffle(raffle);
    const closedAtUnix = unixNow();
    const result = await transactionClient.query(
      "UPDATE raffles SET participation_closed_by_guildie_id=$2, participation_closed_at_unix=$3 WHERE raffle_id=$1 RETURNING *",
      [raffleId, actorGuildieId, closedAtUnix],
    );
    return mapRaffle(result.rows[0] as Record<string, unknown>);
  });
}

export async function cancelRaffle(actorGuildieId: string, raffleId: string, client: PoolClient | null = null): Promise<Raffle> {
  return withOptionalTransaction(client, async (transactionClient) => {
    const raffle = await lockedRaffle(transactionClient, raffleId);
    if (raffle.conclusion !== null) throw new RaffleRuleError("raffle_already_concluded", "A concluded Raffle cannot be cancelled");
    const result = await transactionClient.query(
      "UPDATE raffles SET conclusion='operator_cancelled', concluded_by_guildie_id=$2, concluded_at_unix=$3 WHERE raffle_id=$1 RETURNING *",
      [raffleId, actorGuildieId, unixNow()],
    );
    return mapRaffle(result.rows[0] as Record<string, unknown>);
  });
}

export async function establishRaffleClaim(claimantGuildieId: string, raffleId: string, realmId: string, characterId: string, requestedEntryCount: number): Promise<RaffleClaim> {
  if (!Number.isInteger(requestedEntryCount) || requestedEntryCount <= 0) throw new RaffleRuleError("invalid_entry_count", "Requested entry count must be a positive integer", 400);
  return withTransaction(async (client) => {
    const raffleRow = await lockedRaffle(client, raffleId);
    const raffle = mapRaffle(raffleRow);
    if (!raffleParticipationIsOpen(raffle)) throw new RaffleRuleError("participation_closed", "Raffle participation is closed");

    const characterResult = await client.query<{ character_record_id:string; character_id:string; realm_id:string; character_name:string }>(
      `SELECT c.character_record_id, c.character_id, c.realm_id, grm.character_name
         FROM characters c JOIN guild_roster_memberships grm
           ON grm.region=c.region AND grm.realm_id=c.realm_id AND grm.character_id=c.character_id AND grm.currently_present=true
        WHERE c.guildie_id=$1 AND c.currently_controlled=true AND grm.guild_id=$2 AND c.realm_id=$3 AND c.character_id=$4`,
      [claimantGuildieId, config.guild.id, realmId, characterId],
    );
    if (!characterResult.rowCount) throw new RaffleRuleError("character_not_eligible", "Claim character must be a currently controlled character on the current guild roster", 403);
    const character=characterResult.rows[0];
    const promisedGoldValue=BigInt(String(raffleRow.entry_price_gold))*BigInt(requestedEntryCount);
    const insert=await client.query(
      `INSERT INTO raffle_claims (raffle_id, claimant_guildie_id, character_record_id, requested_entry_count, promised_gold_value, created_at_unix)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [raffleId, claimantGuildieId, character.character_record_id, requestedEntryCount, promisedGoldValue.toString(), unixNow()],
    );
    return mapClaim({...insert.rows[0] as Record<string,unknown>, character_id:character.character_id, realm_id:character.realm_id, character_name:character.character_name});
  });
}

export async function revokeRaffleClaim(claimantGuildieId: string, claimId: string): Promise<void> {
  await withTransaction(async (client) => {
    const claim=await lockedClaim(client, claimId);
    if (claim.claimant_guildie_id!==claimantGuildieId) throw new RaffleRuleError("claim_not_owned", "A member may only revoke their own Raffle claim", 403);
    if (claim.raffle_conclusion!==null) throw new RaffleRuleError("raffle_concluded", "Claims cannot be revoked after the Raffle concludes");
    if (claim.resolution_kind!==null) throw new RaffleRuleError("claim_already_resolved", "Only an unresolved claim can be revoked");
    await client.query("UPDATE raffle_claims SET resolution_kind='revoked', revoked_by_guildie_id=$2, revoked_at_unix=$3 WHERE claim_id=$1", [claimId, claimantGuildieId, unixNow()]);
  });
}

export async function approveRaffleClaim(actorGuildieId:string, claimId:string):Promise<void> {
  await withTransaction(async(client)=>{
    const claim=await lockedClaim(client,claimId);
    if(claim.raffle_conclusion!==null) throw new RaffleRuleError("raffle_concluded","Claims can only be adjudicated before the Raffle concludes");
    if(claim.resolution_kind!==null) throw new RaffleRuleError("claim_already_resolved","Only an unresolved claim can be approved");
    await client.query("UPDATE raffle_claims SET resolution_kind='approved', approved_by_guildie_id=$2, approved_at_unix=$3 WHERE claim_id=$1",[claimId,actorGuildieId,unixNow()]);
  });
}

export async function denyRaffleClaim(actorGuildieId:string, claimId:string, reasonInput:string):Promise<void> {
  const reason=reasonInput.trim();
  if(!reason) throw new RaffleRuleError("denial_reason_required","A denial reason is required",400);
  await withTransaction(async(client)=>{
    const claim=await lockedClaim(client,claimId);
    if(claim.raffle_conclusion!==null) throw new RaffleRuleError("raffle_concluded","Claims can only be adjudicated before the Raffle concludes");
    if(claim.resolution_kind!==null) throw new RaffleRuleError("claim_already_resolved","Only an unresolved claim can be denied");
    await client.query("UPDATE raffle_claims SET resolution_kind='denied', denied_by_guildie_id=$2, denied_at_unix=$3, denial_reason=$4 WHERE claim_id=$1",[claimId,actorGuildieId,unixNow(),reason]);
  });
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

    const approved=await transactionClient.query<{claim_id:string;requested_entry_count:number}>(
      "SELECT claim_id, requested_entry_count FROM raffle_claims WHERE raffle_id=$1 AND resolution_kind='approved' ORDER BY created_at_unix ASC, claim_id ASC",[raffleId]);
    const population:string[]=[];
    for(const claim of approved.rows) for(let index=0;index<claim.requested_entry_count;index+=1) population.push(claim.claim_id);

    if(population.length===0){
      const result=await transactionClient.query(
        "UPDATE raffles SET conclusion='no_participation', concluded_by_guildie_id=$2, concluded_at_unix=$3 WHERE raffle_id=$1 RETURNING *",
        [raffleId,actorGuildieId,now]);
      return mapRaffle(result.rows[0] as Record<string,unknown>);
    }
    const selectedIndex=randomInt(population.length);
    const winningClaimId=population[selectedIndex];
    const result=await transactionClient.query(
      `UPDATE raffles SET conclusion='drawn', concluded_by_guildie_id=$2, concluded_at_unix=$3,
       total_entries=$4, selected_index=$5, winning_claim_id=$6 WHERE raffle_id=$1 RETURNING *`,
      [raffleId,actorGuildieId,now,population.length,selectedIndex,winningClaimId]);
    return mapRaffle(result.rows[0] as Record<string,unknown>);
  });
}

export async function raffle(raffleId:string):Promise<Raffle|null> {
  const result=await pool.query("SELECT * FROM raffles WHERE raffle_id=$1 AND guild_id=$2",[raffleId,config.guild.id]);
  return result.rowCount?mapRaffle(result.rows[0] as Record<string,unknown>):null;
}

export async function raffleClaims(raffleId:string):Promise<RaffleClaim[]> {
  const result=await pool.query(
    `SELECT rc.*, c.character_id, c.realm_id, COALESCE(grm.character_name,c.name) AS character_name
       FROM raffle_claims rc
       JOIN raffles r ON r.raffle_id=rc.raffle_id AND r.guild_id=$2
       JOIN characters c ON c.character_record_id=rc.character_record_id
       LEFT JOIN guild_roster_memberships grm ON grm.guild_id=r.guild_id AND grm.region=c.region AND grm.realm_id=c.realm_id AND grm.character_id=c.character_id
      WHERE rc.raffle_id=$1 ORDER BY rc.created_at_unix ASC, rc.claim_id ASC`,
    [raffleId,config.guild.id]);
  return result.rows.map(row=>mapClaim(row as Record<string,unknown>));
}
