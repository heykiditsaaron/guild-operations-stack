import { config } from "../../config.js";
import { pool } from "../../db.js";
import { getLiveRaffleRound, getRaffleRound, type RaffleClaim, type RaffleRound } from "./application.js";
import type { RaffleClaimResolution } from "./domain.js";

export type RaffleClaimMetrics = {
  claimCount: number;
  pendingClaimCount: number;
  approvedClaimCount: number;
  deniedClaimCount: number;
  cancelledClaimCount: number;
  approvedEntryCount: number;
};

export type RaffleCharacterRecognition = {
  characterId: string;
  name: string;
  realmId: string;
  realmName: string | null;
  realmSlug: string | null;
};

export type RaffleClaimFacts = RaffleClaim & {
  character: RaffleCharacterRecognition;
  resolutionAtUnix: number | null;
  resolutionActorGuildieId: string | null;
};

export type RaffleWinnerFacts = {
  claimId: string;
  character: RaffleCharacterRecognition;
  avatarUrl: string | null;
};

export type RaffleRoundFacts = {
  round: RaffleRound;
  metrics: RaffleClaimMetrics;
  winner: RaffleWinnerFacts | null;
};

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function resolutionAtUnix(claim: RaffleClaim): number | null {
  if (claim.resolutionKind === "approved") return claim.approvedAtUnix;
  if (claim.resolutionKind === "denied") return claim.deniedAtUnix;
  if (claim.resolutionKind === "cancelled") return claim.cancelledAtUnix;
  return null;
}

function resolutionActorGuildieId(claim: RaffleClaim): string | null {
  if (claim.resolutionKind === "approved") return claim.approvedByGuildieId;
  if (claim.resolutionKind === "denied") return claim.deniedByGuildieId;
  if (claim.resolutionKind === "cancelled") return claim.cancelledByGuildieId;
  return null;
}

export async function raffleClaimMetrics(roundId: string): Promise<RaffleClaimMetrics> {
  const result = await pool.query<{
    claim_count: number;
    pending_claim_count: number;
    approved_claim_count: number;
    denied_claim_count: number;
    cancelled_claim_count: number;
    approved_entry_count: number;
  }>(
    `SELECT
       COUNT(*)::int AS claim_count,
       COUNT(*) FILTER (WHERE resolution_kind IS NULL)::int AS pending_claim_count,
       COUNT(*) FILTER (WHERE resolution_kind = 'approved')::int AS approved_claim_count,
       COUNT(*) FILTER (WHERE resolution_kind = 'denied')::int AS denied_claim_count,
       COUNT(*) FILTER (WHERE resolution_kind = 'cancelled')::int AS cancelled_claim_count,
       COALESCE(SUM(requested_entry_count) FILTER (WHERE resolution_kind = 'approved'), 0)::int AS approved_entry_count
     FROM raffle_claims
     WHERE round_id = $1`,
    [roundId],
  );
  const row = result.rows[0];
  return {
    claimCount: Number(row?.claim_count ?? 0),
    pendingClaimCount: Number(row?.pending_claim_count ?? 0),
    approvedClaimCount: Number(row?.approved_claim_count ?? 0),
    deniedClaimCount: Number(row?.denied_claim_count ?? 0),
    cancelledClaimCount: Number(row?.cancelled_claim_count ?? 0),
    approvedEntryCount: Number(row?.approved_entry_count ?? 0),
  };
}

async function raffleWinnerFacts(round: RaffleRound): Promise<RaffleWinnerFacts | null> {
  if (!round.winningClaimId) return null;
  const result = await pool.query<{
    claim_id: string;
    character_id: string;
    character_name: string;
    realm_id: string;
    realm_name: string | null;
    realm_slug: string | null;
    avatar_url: string | null;
  }>(
    `SELECT
       rc.claim_id,
       c.character_id,
       COALESCE(grm.character_name, c.name) AS character_name,
       c.realm_id,
       COALESCE(grm.realm_name, c.realm_name) AS realm_name,
       COALESCE(grm.realm_slug, c.realm_slug) AS realm_slug,
       profile.avatar_url
     FROM raffle_claims rc
     JOIN characters c ON c.character_record_id = rc.character_record_id
     LEFT JOIN guild_roster_memberships grm
       ON grm.guild_id = $2
      AND grm.region = c.region
      AND grm.realm_id = c.realm_id
      AND grm.character_id = c.character_id
     LEFT JOIN wow_character_profiles profile
       ON profile.region = c.region
      AND profile.realm_id = c.realm_id
      AND profile.character_id = c.character_id
     WHERE rc.claim_id = $1`,
    [round.winningClaimId, config.guild.id],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    claimId: String(row.claim_id),
    character: {
      characterId: String(row.character_id),
      name: String(row.character_name),
      realmId: String(row.realm_id),
      realmName: nullableString(row.realm_name),
      realmSlug: nullableString(row.realm_slug),
    },
    avatarUrl: nullableString(row.avatar_url),
  };
}

export async function raffleRoundFacts(roundId: string): Promise<RaffleRoundFacts | null> {
  const round = await getRaffleRound(roundId);
  if (!round) return null;
  const [metrics, winner] = await Promise.all([
    raffleClaimMetrics(round.roundId),
    raffleWinnerFacts(round),
  ]);
  return { round, metrics, winner };
}

export async function liveRaffleRoundFacts(): Promise<RaffleRoundFacts | null> {
  const round = await getLiveRaffleRound();
  return round ? raffleRoundFacts(round.roundId) : null;
}

export async function nextListedRaffleRoundFacts(): Promise<RaffleRoundFacts | null> {
  const result = await pool.query<{ round_id: string }>(
    `SELECT round_id
       FROM raffle_rounds
      WHERE guild_id = $1
        AND status = 'listed'
      ORDER BY drawing_at_unix ASC, created_at_unix ASC, round_id ASC
      LIMIT 1`,
    [config.guild.id],
  );
  const roundId = result.rows[0]?.round_id;
  return roundId ? raffleRoundFacts(String(roundId)) : null;
}

export async function raffleClaimFacts(claimId: string): Promise<RaffleClaimFacts | null> {
  const result = await pool.query<{
    claim_id: string;
    round_id: string;
    claimant_guildie_id: string;
    character_record_id: string;
    character_id: string;
    character_name: string;
    realm_id: string;
    realm_name: string | null;
    realm_slug: string | null;
    requested_entry_count: number;
    promised_gold_value: string;
    created_at_unix: string;
    resolution_kind: RaffleClaimResolution;
    approved_by_guildie_id: string | null;
    approved_at_unix: string | null;
    denied_by_guildie_id: string | null;
    denied_at_unix: string | null;
    denial_reason: string | null;
    cancelled_by_guildie_id: string | null;
    cancelled_at_unix: string | null;
  }>(
    `SELECT
       rc.claim_id,
       rc.round_id,
       rc.claimant_guildie_id,
       rc.character_record_id,
       c.character_id,
       COALESCE(grm.character_name, c.name) AS character_name,
       c.realm_id,
       COALESCE(grm.realm_name, c.realm_name) AS realm_name,
       COALESCE(grm.realm_slug, c.realm_slug) AS realm_slug,
       rc.requested_entry_count,
       rc.promised_gold_value,
       rc.created_at_unix,
       rc.resolution_kind,
       rc.approved_by_guildie_id,
       rc.approved_at_unix,
       rc.denied_by_guildie_id,
       rc.denied_at_unix,
       rc.denial_reason,
       rc.cancelled_by_guildie_id,
       rc.cancelled_at_unix
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
  const claim: RaffleClaim = {
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
    resolutionKind: row.resolution_kind,
    approvedByGuildieId: nullableString(row.approved_by_guildie_id),
    approvedAtUnix: row.approved_at_unix === null ? null : Number(row.approved_at_unix),
    deniedByGuildieId: nullableString(row.denied_by_guildie_id),
    deniedAtUnix: row.denied_at_unix === null ? null : Number(row.denied_at_unix),
    denialReason: nullableString(row.denial_reason),
    cancelledByGuildieId: nullableString(row.cancelled_by_guildie_id),
    cancelledAtUnix: row.cancelled_at_unix === null ? null : Number(row.cancelled_at_unix),
  };
  return {
    ...claim,
    character: {
      characterId: claim.characterId,
      name: claim.characterName,
      realmId: claim.realmId,
      realmName: nullableString(row.realm_name),
      realmSlug: nullableString(row.realm_slug),
    },
    resolutionAtUnix: resolutionAtUnix(claim),
    resolutionActorGuildieId: resolutionActorGuildieId(claim),
  };
}

async function claimFactsForIds(claimIds: string[]): Promise<RaffleClaimFacts[]> {
  const claims = await Promise.all(claimIds.map((claimId) => raffleClaimFacts(claimId)));
  return claims.filter((claim): claim is RaffleClaimFacts => claim !== null);
}

export async function raffleClaimFactsForRound(roundId: string): Promise<RaffleClaimFacts[]> {
  const result = await pool.query<{ claim_id: string }>(
    `SELECT rc.claim_id
       FROM raffle_claims rc
       JOIN raffle_rounds rr
         ON rr.round_id = rc.round_id
        AND rr.guild_id = $2
      WHERE rc.round_id = $1
      ORDER BY rc.created_at_unix ASC, rc.claim_id ASC`,
    [roundId, config.guild.id],
  );
  return claimFactsForIds(result.rows.map((row) => String(row.claim_id)));
}

export async function raffleClaimFactsForMember(
  guildieId: string,
  roundId: string,
): Promise<RaffleClaimFacts[]> {
  const result = await pool.query<{ claim_id: string }>(
    `SELECT rc.claim_id
       FROM raffle_claims rc
       JOIN raffle_rounds rr
         ON rr.round_id = rc.round_id
        AND rr.guild_id = $3
      WHERE rc.round_id = $1
        AND rc.claimant_guildie_id = $2
      ORDER BY rc.created_at_unix DESC, rc.claim_id DESC`,
    [roundId, guildieId, config.guild.id],
  );
  return claimFactsForIds(result.rows.map((row) => String(row.claim_id)));
}

async function roundFactsForIds(roundIds: string[]): Promise<RaffleRoundFacts[]> {
  const rounds = await Promise.all(roundIds.map((roundId) => raffleRoundFacts(roundId)));
  return rounds.filter((round): round is RaffleRoundFacts => round !== null);
}

export async function raffleRoundFactsForOperation(): Promise<RaffleRoundFacts[]> {
  const result = await pool.query<{ round_id: string }>(
    `SELECT round_id
       FROM raffle_rounds
      WHERE guild_id = $1
        AND status IN ('live', 'listed')
      ORDER BY
        CASE status WHEN 'live' THEN 0 ELSE 1 END,
        drawing_at_unix ASC,
        round_id ASC`,
    [config.guild.id],
  );
  return roundFactsForIds(result.rows.map((row) => String(row.round_id)));
}

export async function concludedRaffleRoundFacts(): Promise<RaffleRoundFacts[]> {
  const result = await pool.query<{ round_id: string }>(
    `SELECT round_id
       FROM raffle_rounds
      WHERE guild_id = $1
        AND status = 'concluded'
      ORDER BY concluded_at_unix DESC NULLS LAST, round_id DESC`,
    [config.guild.id],
  );
  return roundFactsForIds(result.rows.map((row) => String(row.round_id)));
}
