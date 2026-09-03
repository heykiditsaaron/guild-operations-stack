import { config } from "../config.js";
import { pool } from "../db.js";
import { raffleRound, type RaffleClaimResolution, type RaffleRoundStatus } from "./domain.js";
import { activeRaffleRound } from "./live-round.js";

export type RaffleQueryRound = {
  roundId: string;
  status: RaffleRoundStatus;
  drawingAtUnix: number;
  ticketPriceGold: string;
  prizeKind: string;
  winnerPercentage: number | null;
  createdAtUnix: number;
  liveAtUnix: number | null;
  concludedAtUnix: number | null;
  claims: {
    pending: number;
    approved: number;
    denied: number;
    cancelled: number;
    approvedTickets: number;
  };
  gold: {
    pot: string;
    winnerPrize: string | null;
    guildShare: string | null;
  } | null;
  totalEntries: number | null;
  winningClaimId: string | null;
  winner: {
    claimId: string;
    characterName: string;
    realmId: string;
    realmName: string | null;
    realmSlug: string | null;
  } | null;
};

export type RaffleQueryClaim = {
  claimId: string;
  roundId: string;
  roundStatus: RaffleRoundStatus;
  character: {
    characterId: string;
    name: string;
    realmId: string;
    realmName: string | null;
    realmSlug: string | null;
  };
  requestedTicketCount: number;
  promisedGoldValue: string;
  createdAtUnix: number;
  resolution: {
    kind: RaffleClaimResolution;
    atUnix: number | null;
    denialReason: string | null;
  };
};

function unixSeconds(value: Date | null): number | null {
  return value ? Math.floor(value.getTime() / 1000) : null;
}

export async function raffleRoundQuery(roundId: string): Promise<RaffleQueryRound | null> {
  const round = await raffleRound(roundId);
  if (!round) return null;

  const metricsResult = await pool.query<{
    pending_claim_count: number;
    approved_claim_count: number;
    denied_claim_count: number;
    cancelled_claim_count: number;
    approved_ticket_count: number;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE resolution_kind IS NULL)::int AS pending_claim_count,
       COUNT(*) FILTER (WHERE resolution_kind = 'approved')::int AS approved_claim_count,
       COUNT(*) FILTER (WHERE resolution_kind = 'denied')::int AS denied_claim_count,
       COUNT(*) FILTER (WHERE resolution_kind = 'cancelled')::int AS cancelled_claim_count,
       COALESCE(SUM(requested_ticket_count) FILTER (WHERE resolution_kind = 'approved'), 0)::int AS approved_ticket_count
     FROM raffle_claims
     WHERE round_id = $1`,
    [round.roundId],
  );

  const metrics = metricsResult.rows[0];
  const approvedTickets = Number(metrics?.approved_ticket_count ?? 0);
  const pot = BigInt(round.ticketPriceGold) * BigInt(approvedTickets);
  const winnerPrize = round.prizeKind === "gold" && round.winnerPercentage !== null
    ? (pot * BigInt(round.winnerPercentage)) / 100n
    : null;
  const guildShare = winnerPrize === null ? null : pot - winnerPrize;

  let winner: RaffleQueryRound["winner"] = null;
  if (round.winningClaimId) {
    const winnerResult = await pool.query<{
      claim_id: string;
      character_name: string;
      realm_id: string;
      realm_name: string | null;
      realm_slug: string | null;
    }>(
      `SELECT
         rc.claim_id,
         COALESCE(grm.character_name, c.name) AS character_name,
         c.realm_id,
         COALESCE(grm.realm_name, c.realm_name) AS realm_name,
         COALESCE(grm.realm_slug, c.realm_slug) AS realm_slug
       FROM raffle_claims rc
       JOIN characters c ON c.character_record_id = rc.character_record_id
       LEFT JOIN guild_roster_memberships grm
         ON grm.guild_id = $2
        AND grm.region = c.region
        AND grm.realm_id = c.realm_id
        AND grm.character_id = c.character_id
       WHERE rc.claim_id = $1`,
      [round.winningClaimId, config.guild.id],
    );
    const row = winnerResult.rows[0];
    if (row) {
      winner = {
        claimId: String(row.claim_id),
        characterName: String(row.character_name),
        realmId: String(row.realm_id),
        realmName: row.realm_name === null ? null : String(row.realm_name),
        realmSlug: row.realm_slug === null ? null : String(row.realm_slug),
      };
    }
  }

  return {
    roundId: round.roundId,
    status: round.status,
    drawingAtUnix: round.drawingAtUnix,
    ticketPriceGold: round.ticketPriceGold,
    prizeKind: round.prizeKind,
    winnerPercentage: round.winnerPercentage,
    createdAtUnix: Math.floor(round.createdAt.getTime() / 1000),
    liveAtUnix: unixSeconds(round.liveAt),
    concludedAtUnix: unixSeconds(round.concludedAt),
    claims: {
      pending: Number(metrics?.pending_claim_count ?? 0),
      approved: Number(metrics?.approved_claim_count ?? 0),
      denied: Number(metrics?.denied_claim_count ?? 0),
      cancelled: Number(metrics?.cancelled_claim_count ?? 0),
      approvedTickets,
    },
    gold: round.prizeKind === "gold"
      ? {
          pot: pot.toString(),
          winnerPrize: winnerPrize?.toString() ?? null,
          guildShare: guildShare?.toString() ?? null,
        }
      : null,
    totalEntries: round.totalEntries,
    winningClaimId: round.winningClaimId,
    winner,
  };
}

export async function liveRaffleRoundQuery(): Promise<RaffleQueryRound | null> {
  const round = await activeRaffleRound();
  return round ? raffleRoundQuery(round.roundId) : null;
}

export async function raffleClaimQuery(claimId: string): Promise<RaffleQueryClaim | null> {
  const result = await pool.query<{
    claim_id: string;
    round_id: string;
    round_status: RaffleRoundStatus;
    character_id: string;
    character_name: string;
    realm_id: string;
    realm_name: string | null;
    realm_slug: string | null;
    requested_ticket_count: number;
    promised_gold_value: string;
    created_at: Date;
    resolution_kind: RaffleClaimResolution;
    approved_at: Date | null;
    denied_at: Date | null;
    cancelled_at: Date | null;
    denial_reason: string | null;
  }>(
    `SELECT
       rc.claim_id,
       rc.round_id,
       rr.status AS round_status,
       c.character_id,
       COALESCE(grm.character_name, c.name) AS character_name,
       c.realm_id,
       COALESCE(grm.realm_name, c.realm_name) AS realm_name,
       COALESCE(grm.realm_slug, c.realm_slug) AS realm_slug,
       rc.requested_ticket_count,
       rc.promised_gold_value,
       rc.created_at,
       rc.resolution_kind,
       rc.approved_at,
       rc.denied_at,
       rc.cancelled_at,
       rc.denial_reason
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
     WHERE rc.claim_id = $1`,
    [claimId, config.guild.id],
  );

  const row = result.rows[0];
  if (!row) return null;

  const resolutionAt = row.resolution_kind === "approved"
    ? row.approved_at
    : row.resolution_kind === "denied"
      ? row.denied_at
      : row.resolution_kind === "cancelled"
        ? row.cancelled_at
        : null;

  return {
    claimId: String(row.claim_id),
    roundId: String(row.round_id),
    roundStatus: row.round_status,
    character: {
      characterId: String(row.character_id),
      name: String(row.character_name),
      realmId: String(row.realm_id),
      realmName: row.realm_name === null ? null : String(row.realm_name),
      realmSlug: row.realm_slug === null ? null : String(row.realm_slug),
    },
    requestedTicketCount: Number(row.requested_ticket_count),
    promisedGoldValue: String(row.promised_gold_value),
    createdAtUnix: Math.floor(row.created_at.getTime() / 1000),
    resolution: {
      kind: row.resolution_kind,
      atUnix: unixSeconds(resolutionAt),
      denialReason: row.denial_reason === null ? null : String(row.denial_reason),
    },
  };
}
