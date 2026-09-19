import { config } from "../../config.js";
import { pool } from "../../db.js";
import { getRaffle, raffleParticipationIsOpen, type Raffle, type RaffleClaim } from "./application.js";
import type { RaffleClaimResolution } from "./domain.js";

export type RaffleClaimMetrics = {
  claimCount: number;
  pendingClaimCount: number;
  approvedClaimCount: number;
  deniedClaimCount: number;
  revokedClaimCount: number;
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

export type RaffleFacts = {
  raffle: Raffle;
  participationOpen: boolean;
  metrics: RaffleClaimMetrics;
  winner: RaffleWinnerFacts | null;
};

function nullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}

function resolutionAtUnix(claim: RaffleClaim): number | null {
  if (claim.resolutionKind === "approved") return claim.approvedAtUnix;
  if (claim.resolutionKind === "denied") return claim.deniedAtUnix;
  if (claim.resolutionKind === "revoked") return claim.revokedAtUnix;
  return null;
}

function resolutionActorGuildieId(claim: RaffleClaim): string | null {
  if (claim.resolutionKind === "approved") return claim.approvedByGuildieId;
  if (claim.resolutionKind === "denied") return claim.deniedByGuildieId;
  if (claim.resolutionKind === "revoked") return claim.revokedByGuildieId;
  return null;
}

export async function raffleClaimMetrics(raffleId: string): Promise<RaffleClaimMetrics> {
  const result = await pool.query<{
    claim_count: number;
    pending_claim_count: number;
    approved_claim_count: number;
    denied_claim_count: number;
    revoked_claim_count: number;
    approved_entry_count: number;
  }>(
    `SELECT COUNT(*)::int AS claim_count,
       COUNT(*) FILTER (WHERE resolution_kind IS NULL)::int AS pending_claim_count,
       COUNT(*) FILTER (WHERE resolution_kind='approved')::int AS approved_claim_count,
       COUNT(*) FILTER (WHERE resolution_kind='denied')::int AS denied_claim_count,
       COUNT(*) FILTER (WHERE resolution_kind='revoked')::int AS revoked_claim_count,
       COALESCE(SUM(requested_entry_count) FILTER (WHERE resolution_kind='approved'),0)::int AS approved_entry_count
       FROM raffle_claims WHERE raffle_id=$1`,
    [raffleId],
  );
  const row=result.rows[0];
  return {
    claimCount:Number(row?.claim_count??0),
    pendingClaimCount:Number(row?.pending_claim_count??0),
    approvedClaimCount:Number(row?.approved_claim_count??0),
    deniedClaimCount:Number(row?.denied_claim_count??0),
    revokedClaimCount:Number(row?.revoked_claim_count??0),
    approvedEntryCount:Number(row?.approved_entry_count??0),
  };
}

async function raffleWinnerFacts(raffle: Raffle): Promise<RaffleWinnerFacts | null> {
  if (!raffle.winningClaimId) return null;
  const result=await pool.query<{
    claim_id:string; character_id:string; character_name:string; realm_id:string;
    realm_name:string|null; realm_slug:string|null; avatar_url:string|null;
  }>(
    `SELECT rc.claim_id,c.character_id,COALESCE(grm.character_name,c.name) AS character_name,c.realm_id,
       COALESCE(grm.realm_name,c.realm_name) AS realm_name,COALESCE(grm.realm_slug,c.realm_slug) AS realm_slug,profile.avatar_url
       FROM raffle_claims rc
       JOIN characters c ON c.character_record_id=rc.character_record_id
       LEFT JOIN guild_roster_memberships grm ON grm.guild_id=$2 AND grm.region=c.region AND grm.realm_id=c.realm_id AND grm.character_id=c.character_id
       LEFT JOIN wow_character_profiles profile ON profile.region=c.region AND profile.realm_id=c.realm_id AND profile.character_id=c.character_id
       WHERE rc.claim_id=$1`,
    [raffle.winningClaimId,config.guild.id],
  );
  const row=result.rows[0];
  if(!row) return null;
  return {claimId:String(row.claim_id),character:{characterId:String(row.character_id),name:String(row.character_name),realmId:String(row.realm_id),realmName:nullableString(row.realm_name),realmSlug:nullableString(row.realm_slug)},avatarUrl:nullableString(row.avatar_url)};
}

export async function raffleFacts(raffleId:string):Promise<RaffleFacts|null>{
  const raffle=await getRaffle(raffleId);
  if(!raffle) return null;
  const [metrics,winner]=await Promise.all([raffleClaimMetrics(raffle.raffleId),raffleWinnerFacts(raffle)]);
  return {raffle,participationOpen:raffleParticipationIsOpen(raffle),metrics,winner};
}

export async function getRaffleClaim(claimId:string):Promise<RaffleClaimFacts|null>{
  const result=await pool.query<{
    claim_id:string;raffle_id:string;claimant_guildie_id:string;character_record_id:string;character_id:string;character_name:string;
    realm_id:string;realm_name:string|null;realm_slug:string|null;requested_entry_count:number;promised_gold_value:string;created_at_unix:string;
    resolution_kind:RaffleClaimResolution;approved_by_guildie_id:string|null;approved_at_unix:string|null;denied_by_guildie_id:string|null;
    denied_at_unix:string|null;denial_reason:string|null;revoked_by_guildie_id:string|null;revoked_at_unix:string|null;
  }>(
    `SELECT rc.claim_id,rc.raffle_id,rc.claimant_guildie_id,rc.character_record_id,c.character_id,
       COALESCE(grm.character_name,c.name) AS character_name,c.realm_id,COALESCE(grm.realm_name,c.realm_name) AS realm_name,
       COALESCE(grm.realm_slug,c.realm_slug) AS realm_slug,rc.requested_entry_count,rc.promised_gold_value,rc.created_at_unix,
       rc.resolution_kind,rc.approved_by_guildie_id,rc.approved_at_unix,rc.denied_by_guildie_id,rc.denied_at_unix,
       rc.denial_reason,rc.revoked_by_guildie_id,rc.revoked_at_unix
       FROM raffle_claims rc JOIN raffles r ON r.raffle_id=rc.raffle_id AND r.guild_id=$2
       JOIN characters c ON c.character_record_id=rc.character_record_id
       LEFT JOIN guild_roster_memberships grm ON grm.guild_id=r.guild_id AND grm.region=c.region AND grm.realm_id=c.realm_id AND grm.character_id=c.character_id
       WHERE rc.claim_id=$1`,
    [claimId,config.guild.id],
  );
  const row=result.rows[0];
  if(!row) return null;
  const claim:RaffleClaim={
    claimId:String(row.claim_id),raffleId:String(row.raffle_id),claimantGuildieId:String(row.claimant_guildie_id),
    characterRecordId:String(row.character_record_id),characterId:String(row.character_id),realmId:String(row.realm_id),
    characterName:String(row.character_name),requestedEntryCount:Number(row.requested_entry_count),promisedGoldValue:String(row.promised_gold_value),
    createdAtUnix:Number(row.created_at_unix),resolutionKind:row.resolution_kind,approvedByGuildieId:nullableString(row.approved_by_guildie_id),
    approvedAtUnix:row.approved_at_unix===null?null:Number(row.approved_at_unix),deniedByGuildieId:nullableString(row.denied_by_guildie_id),
    deniedAtUnix:row.denied_at_unix===null?null:Number(row.denied_at_unix),denialReason:nullableString(row.denial_reason),
    revokedByGuildieId:nullableString(row.revoked_by_guildie_id),revokedAtUnix:row.revoked_at_unix===null?null:Number(row.revoked_at_unix),
  };
  return {...claim,character:{characterId:claim.characterId,name:claim.characterName,realmId:claim.realmId,realmName:nullableString(row.realm_name),realmSlug:nullableString(row.realm_slug)},resolutionAtUnix:resolutionAtUnix(claim),resolutionActorGuildieId:resolutionActorGuildieId(claim)};
}

async function claimFactsForIds(ids:string[]):Promise<RaffleClaimFacts[]>{
  const claims=await Promise.all(ids.map(getRaffleClaim));
  return claims.filter((claim):claim is RaffleClaimFacts=>claim!==null);
}

export async function raffleClaimFactsForRaffle(raffleId:string):Promise<RaffleClaimFacts[]>{
  const result=await pool.query<{claim_id:string}>(
    `SELECT rc.claim_id FROM raffle_claims rc JOIN raffles r ON r.raffle_id=rc.raffle_id AND r.guild_id=$2
       WHERE rc.raffle_id=$1 ORDER BY rc.created_at_unix ASC,rc.claim_id ASC`,[raffleId,config.guild.id]);
  return claimFactsForIds(result.rows.map(row=>String(row.claim_id)));
}

export async function raffleClaimFactsForMember(guildieId:string,raffleId:string):Promise<RaffleClaimFacts[]>{
  const result=await pool.query<{claim_id:string}>(
    `SELECT rc.claim_id FROM raffle_claims rc JOIN raffles r ON r.raffle_id=rc.raffle_id AND r.guild_id=$3
       WHERE rc.raffle_id=$1 AND rc.claimant_guildie_id=$2 ORDER BY rc.created_at_unix DESC,rc.claim_id DESC`,
    [raffleId,guildieId,config.guild.id]);
  return claimFactsForIds(result.rows.map(row=>String(row.claim_id)));
}

async function raffleFactsForIds(ids:string[]):Promise<RaffleFacts[]>{
  const raffles=await Promise.all(ids.map(raffleFacts));
  return raffles.filter((raffle):raffle is RaffleFacts=>raffle!==null);
}

export async function raffleFactsForOperation():Promise<RaffleFacts[]>{
  const result=await pool.query<{raffle_id:string}>(
    `SELECT raffle_id FROM raffles WHERE guild_id=$1 AND conclusion IS NULL
       ORDER BY drawing_at_unix ASC,created_at_unix ASC,raffle_id ASC`,[config.guild.id]);
  return raffleFactsForIds(result.rows.map(row=>String(row.raffle_id)));
}

export async function concludedRaffleFacts():Promise<RaffleFacts[]>{
  const result=await pool.query<{raffle_id:string}>(
    `SELECT raffle_id FROM raffles WHERE guild_id=$1 AND conclusion IS NOT NULL
       ORDER BY concluded_at_unix DESC NULLS LAST,raffle_id DESC`,[config.guild.id]);
  return raffleFactsForIds(result.rows.map(row=>String(row.raffle_id)));
}

export async function openRaffleFacts():Promise<RaffleFacts[]>{
  const operational=await raffleFactsForOperation();
  return operational.filter(facts=>facts.participationOpen);
}
