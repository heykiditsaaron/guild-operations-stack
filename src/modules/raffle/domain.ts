import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { config } from "../../config.js";
import { pool, withTransaction } from "../../db.js";
import { RAFFLE_ADMIN_CAPABILITY, requireGuildCapability } from "../../guild-permissions.js";

export const RAFFLE_CLAIM_CUTOFF_SECONDS = 60 * 60;

export type RaffleRoundStatus =
  | "created"
  | "live"
  | "drawn"
  | "admin_cancelled"
  | "no_entry_cancelled";

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
  drawingAtUnix: number;
  ticketPriceGold: string;
  prizeKind: string;
  winnerPercentage: number | null;
  createdByGuildieId: string;
  createdAt: Date;
  updatedByGuildieId: string | null;
  updatedAt: Date | null;
  liveByGuildieId: string | null;
  liveAt: Date | null;
  concludedByGuildieId: string | null;
  concludedAt: Date | null;
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
  createdAt: Date;
  resolutionKind: RaffleClaimResolution;
  approvedByGuildieId: string | null;
  approvedAt: Date | null;
  deniedByGuildieId: string | null;
  deniedAt: Date | null;
  denialReason: string | null;
  cancelledByGuildieId: string | null;
  cancelledAt: Date | null;
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

export function raffleClaimCutoffUnix(drawingAtUnix: number): number {
  return drawingAtUnix - RAFFLE_CLAIM_CUTOFF_SECONDS;
}

export function raffleClaimsAreOpen(drawingAtUnix: number, nowUnix: number = Math.floor(Date.now() / 1000)): boolean {
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

function mapRound(row: Record<string, unknown>): RaffleRound {
  return {
    roundId: String(row.round_id),
    guildId: String(row.guild_id),
    status: row.status as RaffleRoundStatus,
    drawingAtUnix: Number(row.drawing_at_unix),
    ticketPriceGold: String(row.ticket_price_gold),
    prizeKind: String(row.prize_kind),
    winnerPercentage: row.winner_percentage === null ? null : Number(row.winner_percentage),
    createdByGuildieId: String(row.created_by_guildie_id),
    createdAt: row.created_at as Date,
    updatedByGuildieId: row.updated_by_guildie_id === null || row.updated_by_guildie_id === undefined ? null : String(row.updated_by_guildie_id),
    updatedAt: row.updated_at as Date | null,
    liveByGuildieId: row.live_by_guildie_id === null ? null : String(row.live_by_guildie_id),
    liveAt: row.live_at as Date | null,
    concludedByGuildieId: row.concluded_by_guildie_id === null ? null : String(row.concluded_by_guildie_id),
    concludedAt: row.concluded_at as Date | null,
    totalEntries: row.total_entries === null ? null : Number(row.total_entries),
    selectedIndex: row.selected_index === null ? null : Number(row.selected_index),
    winningClaimId: row.winning_claim_id === null ? null : String(row.winning_claim_id),
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
    createdAt: row.created_at as Date,
    resolutionKind: row.resolution_kind as RaffleClaimResolution,
    approvedByGuildieId: row.approved_by_guildie_id === null ? null : String(row.approved_by_guildie_id),
    approvedAt: row.approved_at as Date | null,
    deniedByGuildieId: row.denied_by_guildie_id === null ? null : String(row.denied_by_guildie_id),
    deniedAt: row.denied_at as Date | null,
    denialReason: row.denial_reason === null ? null : String(row.denial_reason),
    cancelledByGuildieId: row.cancelled_by_guildie_id === null ? null : String(row.cancelled_by_guildie_id),
    cancelledAt: row.cancelled_at as Date | null,
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
  await requireGuildCapability(actorGuildieId, RAFFLE_ADMIN_CAPABILITY);
  const terms = validateTerms(termsInput);
  const result = await pool.query(
    `INSERT INTO raffle_rounds (
       guild_id, drawing_at_unix, ticket_price_gold, prize_kind,
       winner_percentage, created_by_guildie_id
     ) VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      config.guild.id,
      terms.drawingAtUnix,
      String(terms.ticketPriceGold),
      terms.prizeKind,
      terms.winnerPercentage,
      actorGuildieId,
    ],
  );
  return mapRound(result.rows[0] as Record<string, unknown>);
}

export async function updateRaffleRound(
  actorGuildieId: string,
  roundId: string,
  termsInput: RaffleRoundTerms,
): Promise<RaffleRound> {
  await requireGuildCapability(actorGuildieId, RAFFLE_ADMIN_CAPABILITY);
  const terms = validateTerms(termsInput);
  return withTransaction(async (client) => {
    const round = await lockedRound(client, roundId);
    if (round.status !== "created") {
      throw new RaffleRuleError("round_terms_locked", "Round terms are locked once the round is live");
    }
    const result = await client.query(
      `UPDATE raffle_rounds
          SET drawing_at_unix = $2,
              ticket_price_gold = $3,
              prize_kind = $4,
              winner_percentage = $5,
              updated_by_guildie_id = $6,
              updated_at = now()
        WHERE round_id = $1
        RETURNING *`,
      [roundId, terms.drawingAtUnix, String(terms.ticketPriceGold), terms.prizeKind, terms.winnerPercentage, actorGuildieId],
    );
    return mapRound(result.rows[0] as Record<string, unknown>);
  });
}

export async function activateRaffleRound(actorGuildieId: string, roundId: string): Promise<RaffleRound> {
  await requireGuildCapability(actorGuildieId, RAFFLE_ADMIN_CAPABILITY);
  return withTransaction(async (client) => {
    const round = await lockedRound(client, roundId);
    if (round.status !== "created") {
      throw new RaffleRuleError("round_not_created", "Only a created raffle round can become live");
    }
    const result = await client.query(
      `UPDATE raffle_rounds
          SET status = 'live', live_by_guildie_id = $2, live_at = now()
        WHERE round_id = $1
        RETURNING *`,
      [roundId, actorGuildieId],
    );
    return mapRound(result.rows[0] as Record<string, unknown>);
  });
}

export async function cancelRaffleRound(actorGuildieId: string, roundId: string): Promise<RaffleRound> {
  await requireGuildCapability(actorGuildieId, RAFFLE_ADMIN_CAPABILITY);
  return withTransaction(async (client) => {
    const round = await lockedRound(client, roundId);
    if (round.status !== "created" && round.status !== "live") {
      throw new RaffleRuleError("round_already_concluded", "Only a created or live round can be administratively cancelled");
    }
    const result = await client.query(
      `UPDATE raffle_rounds
          SET status = 'admin_cancelled',
              concluded_by_guildie_id = $2,
              concluded_at = now()
        WHERE round_id = $1
        RETURNING *`,
      [roundId, actorGuildieId],
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
    const insert = await client.query(
      `INSERT INTO raffle_claims (
         round_id, claimant_guildie_id, character_record_id,
         requested_ticket_count, promised_gold_value
       ) VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [roundId, claimantGuildieId, character.character_record_id, requestedTicketCount, promisedGoldValue.toString()],
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
    await client.query(
      `UPDATE raffle_claims
          SET resolution_kind = 'cancelled',
              cancelled_by_guildie_id = $2,
              cancelled_at = now()
        WHERE claim_id = $1`,
      [claimId, claimantGuildieId],
    );
  });
}

export async function approveRaffleClaim(actorGuildieId: string, claimId: string): Promise<void> {
  await requireGuildCapability(actorGuildieId, RAFFLE_ADMIN_CAPABILITY);
  await withTransaction(async (client) => {
    const claim = await lockedClaim(client, claimId);
    if (claim.round_status !== "live") {
      throw new RaffleRuleError("round_not_live", "Claims can only be adjudicated while their round is live");
    }
    if (claim.resolution_kind !== null) {
      throw new RaffleRuleError("claim_already_resolved", "Only an unresolved claim can be approved");
    }
    await client.query(
      `UPDATE raffle_claims
          SET resolution_kind = 'approved',
              approved_by_guildie_id = $2,
              approved_at = now()
        WHERE claim_id = $1`,
      [claimId, actorGuildieId],
    );
  });
}

export async function denyRaffleClaim(
  actorGuildieId: string,
  claimId: string,
  reasonInput: string,
): Promise<void> {
  await requireGuildCapability(actorGuildieId, RAFFLE_ADMIN_CAPABILITY);
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
    await client.query(
      `UPDATE raffle_claims
          SET resolution_kind = 'denied',
              denied_by_guildie_id = $2,
              denied_at = now(),
              denial_reason = $3
        WHERE claim_id = $1`,
      [claimId, actorGuildieId, reason],
    );
  });
}

export async function drawRaffleRound(actorGuildieId: string, roundId: string): Promise<RaffleRound> {
  await requireGuildCapability(actorGuildieId, RAFFLE_ADMIN_CAPABILITY);
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
        ORDER BY created_at ASC, claim_id ASC`,
      [roundId],
    );

    const population: string[] = [];
    for (const claim of approved.rows) {
      for (let index = 0; index < claim.requested_ticket_count; index += 1) {
        population.push(claim.claim_id);
      }
    }

    if (population.length === 0) {
      const result = await client.query(
        `UPDATE raffle_rounds
            SET status = 'no_entry_cancelled',
                concluded_by_guildie_id = $2,
                concluded_at = now(),
                total_entries = 0
          WHERE round_id = $1
          RETURNING *`,
        [roundId, actorGuildieId],
      );
      return mapRound(result.rows[0] as Record<string, unknown>);
    }

    const selectedIndex = randomInt(population.length);
    const winningClaimId = population[selectedIndex];
    const result = await client.query(
      `UPDATE raffle_rounds
          SET status = 'drawn',
              concluded_by_guildie_id = $2,
              concluded_at = now(),
              total_entries = $3,
              selected_index = $4,
              winning_claim_id = $5
        WHERE round_id = $1
        RETURNING *`,
      [roundId, actorGuildieId, population.length, selectedIndex, winningClaimId],
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
    ORDER BY rc.created_at ASC, rc.claim_id ASC`,
    [roundId, config.guild.id],
  );
  return result.rows.map((row) => mapClaim(row as Record<string, unknown>));
}
