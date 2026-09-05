import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { config } from "../../config.js";
import { pool, withTransaction } from "../../db.js";
import { requireRaffleAdmin } from "./authorization.js";

export const RAFFLE_CLAIM_CUTOFF_SECONDS = 60 * 60;

export type RaffleRoundStatus = "listed" | "live" | "concluded";
export type RaffleRoundConclusion = "drawn" | "operator_cancelled" | "no_participation" | null;
export type RaffleClaimResolution = "approved" | "denied" | "cancelled" | null;

export type RaffleRoundTerms = {
  drawingAtUnix: number;
  ticketPriceGold: number;
  prizeKind: string;
  winnerPercentage?: number | null;
};

export type RaffleRound = {
  roundId: string;
  guildId: string;
  status: RaffleRoundStatus;
  conclusion: RaffleRoundConclusion;
  drawingAtUnix: number;
  ticketPriceGold: string;
  prizeKind: string;
  winnerPercentage: number | null;
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
  requestedTicketCount: number;
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

export function raffleClaimCutoffUnix(drawingAtUnix: number): number {
  return drawingAtUnix - RAFFLE_CLAIM_CUTOFF_SECONDS;
}

export function raffleClaimsAreOpen(drawingAtUnix: number, nowUnix: number = unixNow()): boolean {
  return nowUnix < raffleClaimCutoffUnix(drawingAtUnix);
}

function validateTerms(terms: RaffleRoundTerms): {
  drawingAtUnix: number;
  ticketPriceGold: number;
  prizeKind: string;
  winnerPercentage: number | null;
} {
  if (!Number.isInteger(terms.drawingAtUnix) || terms.drawingAtUnix < 0) {
    throw new RaffleRuleError("invalid_drawing_time", "Drawing time must be a non-negative Unix timestamp", 400);
  }
  if (!Number.isSafeInteger(terms.ticketPriceGold) || terms.ticketPriceGold <= 0) {
    throw new RaffleRuleError("invalid_ticket_price", "Ticket price must be a positive integer amount of gold", 400);
  }
  const prizeKind = terms.prizeKind.trim();
  if (!prizeKind) {
    throw new RaffleRuleError("invalid_prize_kind", "Prize kind is required", 400);
  }

  const winnerPercentage = terms.winnerPercentage ?? null;
  if (prizeKind === "gold") {
    if (
      typeof winnerPercentage !== "number"
      || !Number.isInteger(winnerPercentage)
      || winnerPercentage < 1
      || winnerPercentage > 100
    ) {
      throw new RaffleRuleError(
        "invalid_winner_percentage",
        "Gold raffle winner percentage must be an integer from 1 through 100",
        400,
      );
    }
  } else if (winnerPercentage !== null) {
    throw new RaffleRuleError(
      "winner_percentage_not_applicable",
      "Winner percentage is only defined for gold prizes",
      400,
    );
  }

  return {
    drawingAtUnix: terms.drawingAtUnix,
    ticketPriceGold: terms.ticketPriceGold,
    prizeKind,
    winnerPercentage,
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
    drawingAtUnix: Number(row.drawing_at_unix),
    ticketPriceGold: String(row.ticket_price_gold),
    prizeKind: String(row.prize_kind),
    winnerPercentage: nullableNumber(row.winner_percentage),
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
    requestedTicketCount: Number(row.requested_ticket_count),
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
): Promise<RaffleRound> {
  await requireRaffleAdmin(actorGuildieId);
  const terms = validateTerms(termsInput);
  const createdAtUnix = unixNow();
  const result = await pool.query(
    `INSERT INTO raffle_rounds (
       guild_id, drawing_at_unix, ticket_price_gold, prize_kind,
       winner_percentage, created_by_guildie_id, created_at_unix
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      config.guild.id,
      terms.drawingAtUnix,
      String(terms.ticketPriceGold),
      terms.prizeKind,
      terms.winnerPercentage,
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
): Promise<RaffleRound> {
  await requireRaffleAdmin(actorGuildieId);
  const terms = validateTerms(termsInput);
  return withTransaction(async (client) => {
    const round = await lockedRound(client, roundId);
    if (round.status !== "listed") {
      throw new RaffleRuleError("round_terms_locked", "Round terms are locked once the round is live");
    }
    const updatedAtUnix = unixNow();
    const result = await client.query(
      `UPDATE raffle_rounds
          SET drawing_at_unix = $2,
              ticket_price_gold = $3,
              prize_kind = $4,
              winner_percentage = $5,
              updated_by_guildie_id = $6,
              updated_at_unix = $7
        WHERE round_id = $1
        RETURNING *`,
      [
        roundId,
        terms.drawingAtUnix,
        String(terms.ticketPriceGold),
        terms.prizeKind,
        terms.winnerPercentage,
        actorGuildieId,
        updatedAtUnix,
      ],
    );
    return mapRound(result.rows[0] as Record<string, unknown>);
  });
}

export async function activateRaffleRound(actorGuildieId: string, roundId: string): Promise<RaffleRound> {
  await requireRaffleAdmin(actorGuildieId);
  return withTransaction(async (client) => {
    const round = await lockedRound(client, roundId);
    if (round.status !== "listed") {
      throw new RaffleRuleError("round_not_listed", "Only a listed raffle round can become live");
    }
    const liveAtUnix = unixNow();
    const result = await client.query(
      `UPDATE raffle_rounds
          SET status = 'live', live_by_guildie_id = $2, live_at_unix = $3
        WHERE round_id = $1
        RETURNING *`,
      [roundId, actorGuildieId, liveAtUnix],
    );
    return mapRound(result.rows[0] as Record<string, unknown>);
  });
}

export async function cancelRaffleRound(actorGuildieId: string, roundId: string): Promise<RaffleRound> {
  await requireRaffleAdmin(actorGuildieId);
  return withTransaction(async (client) => {
    const round = await lockedRound(client, roundId);
    if (round.status !== "listed" && round.status !== "live") {
      throw new RaffleRuleError("round_already_concluded", "Only a listed or live round can be administratively cancelled");
    }
    const concludedAtUnix = unixNow();
    const result = await client.query(
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
  requestedTicketCount: number,
): Promise<RaffleClaim> {
  if (!Number.isInteger(requestedTicketCount) || requestedTicketCount <= 0) {
    throw new RaffleRuleError("invalid_ticket_count", "Requested ticket count must be a positive integer", 400);
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

    const promisedGoldValue = BigInt(String(round.ticket_price_gold)) * BigInt(requestedTicketCount);
    const character = characterResult.rows[0];
    const createdAtUnix = unixNow();
    const insert = await client.query(
      `INSERT INTO raffle_claims (
         round_id, claimant_guildie_id, character_record_id,
         requested_ticket_count, promised_gold_value, created_at_unix
       ) VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        roundId,
        claimantGuildieId,
        character.character_record_id,
        requestedTicketCount,
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

export async function drawRaffleRound(actorGuildieId: string, roundId: string): Promise<RaffleRound> {
  await requireRaffleAdmin(actorGuildieId);
  return withTransaction(async (client) => {
    const round = await lockedRound(client, roundId);
    if (round.status !== "live") {
      throw new RaffleRuleError("round_not_live", "Only a live raffle round can be drawn");
    }

    const pending = await client.query<{ count: string }>(
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

    const approved = await client.query<{ claim_id: string; requested_ticket_count: number }>(
      `SELECT claim_id, requested_ticket_count
         FROM raffle_claims
        WHERE round_id = $1
          AND resolution_kind = 'approved'
        ORDER BY created_at_unix ASC, claim_id ASC`,
      [roundId],
    );

    const population: string[] = [];
    for (const claim of approved.rows) {
      for (let index = 0; index < claim.requested_ticket_count; index += 1) {
        population.push(claim.claim_id);
      }
    }

    const concludedAtUnix = unixNow();
    if (population.length === 0) {
      const result = await client.query(
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
    const result = await client.query(
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
