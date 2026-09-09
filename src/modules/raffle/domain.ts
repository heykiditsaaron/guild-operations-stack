import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { config } from "../../config.js";
import { pool, withTransaction } from "../../db.js";
import { requireRaffleAdmin } from "./authorization.js";

export const RAFFLE_CLAIM_CUTOFF_SECONDS = 60 * 60;

export type RaffleRoundStatus = "listed" | "live" | "concluded";
export type RaffleRoundConclusion = "drawn" | "operator_cancelled" | "no_participation" | null;
export type RafflePrizeKind = "gold" | "item" | "other";
export type RaffleClaimResolution = "approved" | "denied" | "cancelled" | null;

export type RaffleRoundTerms = {
  roundTitle?: string | null;
  drawingAtUnix: number;
  entryPriceGold: number;
  prizeKind: RafflePrizeKind;
  winnerPercentage?: number | null;
  prizeDescription?: string | null;
};

export type RaffleRound = {
  roundId: string;
  guildId: string;
  status: RaffleRoundStatus;
  conclusion: RaffleRoundConclusion;
  roundTitle: string | null;
  drawingAtUnix: number;
  entryPriceGold: string;
  prizeKind: RafflePrizeKind;
  winnerPercentage: number | null;
  prizeDescription: string | null;
  createdByGuildieId: string;
  createdAtUnix: number;
  updatedByGuildieId: string | null;
  updatedAtUnix: number | null;
  liveByGuildieId: string | null;
  liveAtUnix: number | null;
  concludedByGuildieId: string | null;
  concludedAtUnix: number | null;
  totalEntries: number | null;
  selectedIndex: number | null;
  winningClaimId: string | null;
};

export type RaffleClaim = {
  claimId: string;
  roundId: string;
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
  cancelledByGuildieId: string | null;
  cancelledAtUnix: number | null;
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

export function raffleClaimCutoffUnix(drawingAtUnix: number): number {
  return drawingAtUnix - RAFFLE_CLAIM_CUTOFF_SECONDS;
}

export function raffleClaimsAreOpen(drawingAtUnix: number, nowUnix: number = unixNow()): boolean {
  return nowUnix < raffleClaimCutoffUnix(drawingAtUnix);
}

function validateTerms(terms: RaffleRoundTerms): {
  roundTitle: string | null;
  drawingAtUnix: number;
  entryPriceGold: number;
  prizeKind: RafflePrizeKind;
  winnerPercentage: number | null;
  prizeDescription: string | null;
} {
  if (!Number.isInteger(terms.drawingAtUnix) || terms.drawingAtUnix < 0) {
    throw new RaffleRuleError("invalid_drawing_time", "Drawing time must be a non-negative Unix timestamp", 400);
  }
  if (!Number.isSafeInteger(terms.entryPriceGold) || terms.entryPriceGold <= 0) {
    throw new RaffleRuleError("invalid_entry_price", "Entry price must be a positive integer amount of gold", 400);
  }
  if (terms.prizeKind !== "gold" && terms.prizeKind !== "item" && terms.prizeKind !== "other") {
    throw new RaffleRuleError("invalid_prize_kind", "Prize type must be gold, item, or other", 400);
  }

  const roundTitle = terms.roundTitle?.trim() || null;
  const winnerPercentage = terms.winnerPercentage ?? null;
  const prizeDescription = terms.prizeDescription?.trim() || null;
  if (terms.prizeKind === "gold") {
    if (
      typeof winnerPercentage !== "number"
      || !Number.isInteger(winnerPercentage)
      || winnerPercentage < 1
      || winnerPercentage > 100
    ) {
      throw new RaffleRuleError(
        "invalid_winner_percentage",
        "Gold raffle prize percentage must be an integer from 1 through 100",
        400,
      );
    }
    if (prizeDescription !== null) {
      throw new RaffleRuleError(
        "prize_description_not_applicable",
        "Gold raffle prizes are defined by winner percentage",
        400,
      );
    }
  } else {
    if (winnerPercentage !== null) {
      throw new RaffleRuleError(
        "winner_percentage_not_applicable",
        "Winner percentage is only defined for gold prizes",
        400,
      );
    }
    if (!prizeDescription) {
      throw new RaffleRuleError(
        "prize_description_required",
        "Item and other prizes require a description",
        400,
      );
    }
  }

  return {
    roundTitle,
    drawingAtUnix: terms.drawingAtUnix,
    entryPriceGold: terms.entryPriceGold,
    prizeKind: terms.prizeKind,
    winnerPercentage,
    prizeDescription,
  };
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function mapRound(row: Record<string, unknown>): RaffleRound {
  return {
    roundId: String(row.round_id),
    guildId: String(row.guild_id),
    status: row.status as RaffleRoundStatus,
    conclusion: row.conclusion as RaffleRoundConclusion,
    roundTitle: nullableString(row.round_title),
    drawingAtUnix: Number(row.drawing_at_unix),
    entryPriceGold: String(row.entry_price_gold),
    prizeKind: row.prize_kind as RafflePrizeKind,
    winnerPercentage: nullableNumber(row.winner_percentage),
    prizeDescription: nullableString(row.prize_description),
    createdByGuildieId: String(row.created_by_guildie_id),
    createdAtUnix: Number(row.created_at_unix),
    updatedByGuildieId: nullableString(row.updated_by_guildie_id),
    updatedAtUnix: nullableNumber(row.updated_at_unix),
    liveByGuildieId: nullableString(row.live_by_guildie_id),
    liveAtUnix: nullableNumber(row.live_at_unix),
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
    roundId: String(row.round_id),
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
    cancelledByGuildieId: nullableString(row.cancelled_by_guildie_id),
    cancelledAtUnix: nullableNumber(row.cancelled_at_unix),
  };
}

async function lockedRound(client: PoolClient, roundId: string): Promise<Record<string, unknown>> {
  const result = await client.query(
    `SELECT * FROM raffle_rounds WHERE round_id = $1 AND guild_id = $2 FOR UPDATE`,
    [roundId, config.guild.id],
  );
  if (!result.rowCount) {
    throw new RaffleRuleError("round_not_found", "Raffle round was not found", 404);
  }
  return result.rows[0] as Record<string, unknown>;
}

async function lockedClaim(client: PoolClient, claimId: string): Promise<Record<string, unknown>> {
  const result = await client.query(
    `SELECT rc.*, rr.status AS round_status
       FROM raffle_claims rc
       JOIN raffle_rounds rr ON rr.round_id = rc.round_id
      WHERE rc.claim_id = $1
        AND rr.guild_id = $2
      FOR UPDATE OF rc, rr`,
    [claimId, config.guild.id],
  );
  if (!result.rowCount) {
    throw new RaffleRuleError("claim_not_found", "Raffle claim was not found", 404);
  }
  return result.rows[0] as Record<string, unknown>;
}

export async function createRaffleRound(
  actorGuildieId: string,
  termsInput: RaffleRoundTerms,
  client: PoolClient | null = null,
): Promise<RaffleRound> {
  await requireRaffleAdmin(actorGuildieId);
  const terms = validateTerms(termsInput);
  const createdAtUnix = unixNow();
  const executor = client ?? pool;
  const result = await executor.query(
    `INSERT INTO raffle_rounds (
       guild_id, round_title, drawing_at_unix, entry_price_gold, prize_kind,
       winner_percentage, prize_description, created_by_guildie_id, created_at_unix
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      config.guild.id,
      terms.roundTitle,
      terms.drawingAtUnix,
      String(terms.entryPriceGold),
      terms.prizeKind,
      terms.winnerPercentage,
      terms.prizeDescription,
      actorGuildieId,
      createdAtUnix,
    ],
  );
  return mapRound(result.rows[0] as Record<string, unknown>);
}

export async function updateRaffleRound(
  actorGuildieId: string,
  roundId: string,
  termsInput: RaffleRoundTerms,
  client: PoolClient | null = null,
): Promise<RaffleRound> {
  await requireRaffleAdmin(actorGuildieId);
  const terms = validateTerms(termsInput);
  return withOptionalTransaction(client, async (transactionClient) => {
    const round = await lockedRound(transactionClient, roundId);
    if (round.status !== "listed") {
      throw new RaffleRuleError("round_terms_locked", "Round terms are locked once the round is live");
    }
    const updatedAtUnix = unixNow();
    const result = await transactionClient.query(
      `UPDATE raffle_rounds
          SET round_title = $2,
              drawing_at_unix = $3,
              entry_price_gold = $4,
              prize_kind = $5,
              winner_percentage = $6,
              prize_description = $7,
              updated_by_guildie_id = $8,
              updated_at_unix = $9
        WHERE round_id = $1
        RETURNING *`,
      [
        roundId,
        terms.roundTitle,
        terms.drawingAtUnix,
        String(terms.entryPriceGold),
        terms.prizeKind,
        terms.winnerPercentage,
        terms.prizeDescription,
        actorGuildieId,
        updatedAtUnix,
      ],
    );
    return mapRound(result.rows[0] as Record<string, unknown>);
  });
}

export async function activateRaffleRound(
  actorGuildieId: string,
  roundId: string,
  client: PoolClient | null = null,
): Promise<RaffleRound> {
  await requireRaffleAdmin(actorGuildieId);
  return withOptionalTransaction(client, async (transactionClient) => {
    const round = await lockedRound(transactionClient, roundId);
    if (round.status !== "listed") {
      throw new RaffleRuleError("round_not_listed", "Only a listed raffle round can become live");
    }
    const liveAtUnix = unixNow();
    const result = await transactionClient.query(
      `UPDATE raffle_rounds
          SET status = 'live', live_by_guildie_id = $2, live_at_unix = $3
        WHERE round_id = $1
        RETURNING *`,
      [roundId, actorGuildieId, liveAtUnix],
    );
    return mapRound(result.rows[0] as Record<string, unknown>);
  });
}

export async function cancelRaffleRound(
  actorGuildieId: string,
  roundId: string,
  client: PoolClient | null = null,
): Promise<RaffleRound> {
  await requireRaffleAdmin(actorGuildieId);
  return withOptionalTransaction(client, async (transactionClient) => {
    const round = await lockedRound(transactionClient, roundId);
    if (round.status !== "listed" && round.status !== "live") {
      throw new RaffleRuleError("round_already_concluded", "Only a listed or live round can be administratively cancelled");
    }
    const concludedAtUnix = unixNow();
    const result = await transactionClient.query(
      `UPDATE raffle_rounds
          SET status = 'concluded',
              conclusion = 'operator_cancelled',
              concluded_by_guildie_id = $2,
              concluded_at_unix = $3
        WHERE round_id = $1
        RETURNING *`,
      [roundId, actorGuildieId, concludedAtUnix],
    );
    return mapRound(result.rows[0] as Record<string, unknown>);
  });
}

export async function submitRaffleClaim(
  claimantGuildieId: string,
  roundId: string,
  realmId: string,
  characterId: string,
  requestedEntryCount: number,
): Promise<RaffleClaim> {
  if (!Number.isInteger(requestedEntryCount) || requestedEntryCount <= 0) {
    throw new RaffleRuleError("invalid_entry_count", "Requested entry count must be a positive integer", 400);
  }

  return withTransaction(async (client) => {
    const round = await lockedRound(client, roundId);
    if (round.status !== "live") {
      throw new RaffleRuleError("round_not_live", "Claims may only be submitted to a live raffle round");
    }
    if (!raffleClaimsAreOpen(Number(round.drawing_at_unix))) {
      throw new RaffleRuleError(
        "claim_submission_closed",
        "Raffle claims close one hour before the drawing deadline so attendants can finish adjudication",
      );
    }

    const characterResult = await client.query<{
      character_record_id: string;
      character_id: string;
      realm_id: string;
      character_name: string;
    }>(
      `SELECT c.character_record_id, c.character_id, c.realm_id, grm.character_name
         FROM characters c
         JOIN guild_roster_memberships grm
           ON grm.region = c.region
          AND grm.realm_id = c.realm_id
          AND grm.character_id = c.character_id
          AND grm.currently_present = true
        WHERE c.guildie_id = $1
          AND c.currently_controlled = true
          AND grm.guild_id = $2
          AND c.realm_id = $3
          AND c.character_id = $4`,
      [claimantGuildieId, config.guild.id, realmId, characterId],
    );
    if (!characterResult.rowCount) {
      throw new RaffleRuleError(
        "character_not_eligible",
        "Claim character must be a currently controlled character on the current guild roster",
        403,
      );
    }

    const promisedGoldValue = BigInt(String(round.entry_price_gold)) * BigInt(requestedEntryCount);
    const character = characterResult.rows[0];
    const createdAtUnix = unixNow();
    const insert = await client.query(
      `INSERT INTO raffle_claims (
         round_id, claimant_guildie_id, character_record_id,
         requested_entry_count, promised_gold_value, created_at_unix
       ) VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        roundId,
        claimantGuildieId,
        character.character_record_id,
        requestedEntryCount,
        promisedGoldValue.toString(),
        createdAtUnix,
      ],
    );

    return mapClaim({
      ...(insert.rows[0] as Record<string, unknown>),
      character_id: character.character_id,
      realm_id: character.realm_id,
      character_name: character.character_name,
    });
  });
}

export async function cancelOwnRaffleClaim(claimantGuildieId: string, claimId: string): Promise<void> {
  await withTransaction(async (client) => {
    const claim = await lockedClaim(client, claimId);
    if (claim.claimant_guildie_id !== claimantGuildieId) {
      throw new RaffleRuleError("claim_not_owned", "A member may only cancel their own raffle claim", 403);
    }
    if (claim.round_status !== "live") {
      throw new RaffleRuleError("round_not_live", "Claims cannot be cancelled after the round concludes");
    }
    if (claim.resolution_kind !== null) {
      throw new RaffleRuleError("claim_already_resolved", "Only an unresolved claim can be cancelled");
    }
    const cancelledAtUnix = unixNow();
    await client.query(
      `UPDATE raffle_claims
          SET resolution_kind = 'cancelled',
              cancelled_by_guildie_id = $2,
              cancelled_at_unix = $3
        WHERE claim_id = $1`,
      [claimId, claimantGuildieId, cancelledAtUnix],
    );
  });
}

export async function approveRaffleClaim(actorGuildieId: string, claimId: string): Promise<void> {
  await requireRaffleAdmin(actorGuildieId);
  await withTransaction(async (client) => {
    const claim = await lockedClaim(client, claimId);
    if (claim.round_status !== "live") {
      throw new RaffleRuleError("round_not_live", "Claims can only be adjudicated while their round is live");
    }
    if (claim.resolution_kind !== null) {
      throw new RaffleRuleError("claim_already_resolved", "Only an unresolved claim can be approved");
    }
    const approvedAtUnix = unixNow();
    await client.query(
      `UPDATE raffle_claims
          SET resolution_kind = 'approved',
              approved_by_guildie_id = $2,
              approved_at_unix = $3
        WHERE claim_id = $1`,
      [claimId, actorGuildieId, approvedAtUnix],
    );
  });
}

export async function denyRaffleClaim(
  actorGuildieId: string,
  claimId: string,
  reasonInput: string,
): Promise<void> {
  await requireRaffleAdmin(actorGuildieId);
  const reason = reasonInput.trim();
  if (!reason) {
    throw new RaffleRuleError("denial_reason_required", "A denial reason is required", 400);
  }

  await withTransaction(async (client) => {
    const claim = await lockedClaim(client, claimId);
    if (claim.round_status !== "live") {
      throw new RaffleRuleError("round_not_live", "Claims can only be adjudicated while their round is live");
    }
    if (claim.resolution_kind !== null) {
      throw new RaffleRuleError("claim_already_resolved", "Only an unresolved claim can be denied");
    }
    const deniedAtUnix = unixNow();
    await client.query(
      `UPDATE raffle_claims
          SET resolution_kind = 'denied',
              denied_by_guildie_id = $2,
              denied_at_unix = $3,
              denial_reason = $4
        WHERE claim_id = $1`,
      [claimId, actorGuildieId, deniedAtUnix, reason],
    );
  });
}

export async function drawRaffleRound(
  actorGuildieId: string,
  roundId: string,
  client: PoolClient | null = null,
): Promise<RaffleRound> {
  await requireRaffleAdmin(actorGuildieId);
  return withOptionalTransaction(client, async (transactionClient) => {
    const round = await lockedRound(transactionClient, roundId);
    if (round.status !== "live") {
      throw new RaffleRuleError("round_not_live", "Only a live raffle round can be drawn");
    }

    const pending = await transactionClient.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM raffle_claims
        WHERE round_id = $1
          AND resolution_kind IS NULL`,
      [roundId],
    );
    if (Number(pending.rows[0].count) > 0) {
      throw new RaffleRuleError(
        "unresolved_claims",
        "All claims must be approved, denied, or cancelled before the round can be drawn",
      );
    }

    const approved = await transactionClient.query<{ claim_id: string; requested_entry_count: number }>(
      `SELECT claim_id, requested_entry_count
         FROM raffle_claims
        WHERE round_id = $1
          AND resolution_kind = 'approved'
        ORDER BY created_at_unix ASC, claim_id ASC`,
      [roundId],
    );

    const population: string[] = [];
    for (const claim of approved.rows) {
      for (let index = 0; index < claim.requested_entry_count; index += 1) {
        population.push(claim.claim_id);
      }
    }

    const concludedAtUnix = unixNow();
    if (population.length === 0) {
      const result = await transactionClient.query(
        `UPDATE raffle_rounds
            SET status = 'concluded',
                conclusion = 'no_participation',
                concluded_by_guildie_id = $2,
                concluded_at_unix = $3
          WHERE round_id = $1
          RETURNING *`,
        [roundId, actorGuildieId, concludedAtUnix],
      );
      return mapRound(result.rows[0] as Record<string, unknown>);
    }

    const selectedIndex = randomInt(population.length);
    const winningClaimId = population[selectedIndex];
    const result = await transactionClient.query(
      `UPDATE raffle_rounds
          SET status = 'concluded',
              conclusion = 'drawn',
              concluded_by_guildie_id = $2,
              concluded_at_unix = $3,
              total_entries = $4,
              selected_index = $5,
              winning_claim_id = $6
        WHERE round_id = $1
        RETURNING *`,
      [roundId, actorGuildieId, concludedAtUnix, population.length, selectedIndex, winningClaimId],
    );
    return mapRound(result.rows[0] as Record<string, unknown>);
  });
}

export async function raffleRound(roundId: string): Promise<RaffleRound | null> {
  const result = await pool.query(
    `SELECT * FROM raffle_rounds WHERE round_id = $1 AND guild_id = $2`,
    [roundId, config.guild.id],
  );
  return result.rowCount ? mapRound(result.rows[0] as Record<string, unknown>) : null;
}

export async function raffleClaims(roundId: string): Promise<RaffleClaim[]> {
  const result = await pool.query(
    `SELECT
       rc.*,
       c.character_id,
       c.realm_id,
       COALESCE(grm.character_name, c.name) AS character_name
     FROM raffle_claims rc
     JOIN raffle_rounds rr
       ON rr.round_id = rc.round_id
      AND rr.guild_id = $2
     JOIN characters c ON c.character_record_id = rc.character_record_id
     LEFT JOIN guild_roster_memberships grm
       ON grm.guild_id = rr.guild_id
      AND grm.region = c.region
      AND grm.realm_id = c.realm_id
      AND grm.character_id = c.character_id
    WHERE rc.round_id = $1
    ORDER BY rc.created_at_unix ASC, rc.claim_id ASC`,
    [roundId, config.guild.id],
  );
  return result.rows.map((row) => mapClaim(row as Record<string, unknown>));
}
