import { characterByRecordId } from "../../core/identity/controlled-characters.js";
import type { ActivitySharedValue } from "../../core/activity/registry.js";
import { activityParticipationOfferById, activityParticipationOffersForActivity } from "../../core/activity/participation.js";
import { requireOperationalInstallationGuildBinding } from "../../core/installation/guild-binding.js";
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
    claim_id: string;
    resolution_kind: RaffleClaimResolution;
  }>(
    `SELECT claim_id,resolution_kind FROM raffle_claims WHERE raffle_id=$1`,
    [raffleId],
  );
  const approvedClaimIds = result.rows
    .filter((row) => row.resolution_kind === "approved")
    .map((row) => String(row.claim_id));
  const client = await pool.connect();
  let approvedEntryCount = 0;
  try {
    const offers = await activityParticipationOffersForActivity(client, {
      activityKind: "raffle",
      activityId: raffleId,
      procedureReferences: approvedClaimIds,
    });
    for (const offer of offers) {
      const component = offer.context.find((candidate) => candidate.name === "claim")?.value;
      if (Array.isArray(component)) continue;
      const value = component as ActivitySharedValue | undefined;
      if (value?.type === "integer") approvedEntryCount += value.value;
    }
  } finally {
    client.release();
  }
  return {
    claimCount: result.rows.length,
    pendingClaimCount: result.rows.filter((row) => row.resolution_kind === null).length,
    approvedClaimCount: approvedClaimIds.length,
    deniedClaimCount: result.rows.filter((row) => row.resolution_kind === "denied").length,
    revokedClaimCount: result.rows.filter((row) => row.resolution_kind === "revoked").length,
    approvedEntryCount,
  };
}
async function raffleWinnerFacts(raffle: Raffle): Promise<RaffleWinnerFacts | null> {
  if (!raffle.winningParticipationOfferId) return null;
  const client=await pool.connect();
  try {
    const offer=await activityParticipationOfferById(client,{
      activityKind:"raffle",
      activityId:raffle.raffleId,
      participationOfferId:raffle.winningParticipationOfferId,
    });
    const characterComponent=offer?.context.find((item)=>item.name==="character")?.value;
    if(!offer||Array.isArray(characterComponent)) return null;
    const characterValue=characterComponent as ActivitySharedValue|undefined;
    if(characterValue?.type==="string") {
      return {
        claimId: offer.procedureReference,
        character: {
          characterId: "",
          name: characterValue.value,
          realmId: "",
          realmName: null,
          realmSlug: null,
        },
        avatarUrl: null,
      };
    }
    if(characterValue?.type!=="guild_character") return null;
    const offeredCharacter=characterValue.value;
    const recognizedCharacter=await characterByRecordId(offeredCharacter.characterRecordId);
    return {
      claimId:offer.procedureReference,
      character:{
        characterId:offeredCharacter.characterId,
        name:recognizedCharacter?.name??offeredCharacter.name,
        realmId:offeredCharacter.realmId,
        realmName:recognizedCharacter?.realmName??null,
        realmSlug:recognizedCharacter?.realmSlug??null,
      },
      avatarUrl:recognizedCharacter?.avatarUrl??null,
    };
  } finally {
    client.release();
  }
}
export async function raffleFacts(raffleId:string):Promise<RaffleFacts|null>{
  const raffle=await getRaffle(raffleId);
  if(!raffle) return null;
  const [metrics,winner]=await Promise.all([raffleClaimMetrics(raffle.raffleId),raffleWinnerFacts(raffle)]);
  return {raffle,participationOpen:raffleParticipationIsOpen(raffle),metrics,winner};
}

export async function getRaffleClaim(claimId:string):Promise<RaffleClaimFacts|null>{
  const guildId=(await requireOperationalInstallationGuildBinding()).guildId;
  const result=await pool.query<{
    claim_id:string;raffle_id:string;promised_gold_value:string;created_at_unix:string;
    resolution_kind:RaffleClaimResolution;approved_by_identity_id:string|null;approved_at_unix:string|null;denied_by_identity_id:string|null;
    denied_at_unix:string|null;denial_reason:string|null;revoked_by_identity_id:string|null;revoked_at_unix:string|null;
  }>(
    `SELECT rc.claim_id,rc.raffle_id,rc.promised_gold_value,rc.created_at_unix,
       rc.resolution_kind,rc.approved_by_identity_id,rc.approved_at_unix,rc.denied_by_identity_id,rc.denied_at_unix,
       rc.denial_reason,rc.revoked_by_identity_id,rc.revoked_at_unix
       FROM raffle_claims rc JOIN raffles r ON r.raffle_id=rc.raffle_id AND r.guild_id=$2
       WHERE rc.claim_id=$1`,
    [claimId,guildId],
  );
  const row=result.rows[0];
  if(!row) return null;

  const client=await pool.connect();
  try {
    const offers=await activityParticipationOffersForActivity(client,{
      activityKind:"raffle",
      activityId:String(row.raffle_id),
      procedureReferences:[claimId],
    });
    const offer=offers[0];
    if(!offer || offer.actor.kind!=="native") return null;
    const characterComponent=offer.context.find((item)=>item.name==="character")?.value;
    const claimComponent=offer.context.find((item)=>item.name==="claim")?.value;
    if(Array.isArray(characterComponent)||Array.isArray(claimComponent)) return null;
    const characterValue=characterComponent as ActivitySharedValue|undefined;
    const claimValue=claimComponent as ActivitySharedValue|undefined;
    if(characterValue?.type!=="guild_character"||claimValue?.type!=="integer") return null;
    const offeredCharacter=characterValue.value;
    const recognizedCharacter=await characterByRecordId(offeredCharacter.characterRecordId);
    const characterName=recognizedCharacter?.name ?? offeredCharacter.name;
    const realmName=recognizedCharacter?.realmName ?? null;
    const realmSlug=recognizedCharacter?.realmSlug ?? null;
    const claim:RaffleClaim={
      claimId:String(row.claim_id),raffleId:String(row.raffle_id),claimantGuildieId:offer.actor.reference,
      characterRecordId:offeredCharacter.characterRecordId,characterId:offeredCharacter.characterId,realmId:offeredCharacter.realmId,
      characterName,requestedEntryCount:claimValue.value,promisedGoldValue:String(row.promised_gold_value),
      createdAtUnix:Number(row.created_at_unix),resolutionKind:row.resolution_kind,approvedByGuildieId:nullableString(row.approved_by_identity_id),
      approvedAtUnix:row.approved_at_unix===null?null:Number(row.approved_at_unix),deniedByGuildieId:nullableString(row.denied_by_identity_id),
      deniedAtUnix:row.denied_at_unix===null?null:Number(row.denied_at_unix),denialReason:nullableString(row.denial_reason),
      revokedByGuildieId:nullableString(row.revoked_by_identity_id),revokedAtUnix:row.revoked_at_unix===null?null:Number(row.revoked_at_unix),
    };
    return {...claim,character:{characterId:offeredCharacter.characterId,name:characterName,realmId:offeredCharacter.realmId,realmName,realmSlug},resolutionAtUnix:resolutionAtUnix(claim),resolutionActorGuildieId:resolutionActorGuildieId(claim)};
  } finally {
    client.release();
  }
}
async function claimFactsForIds(ids:string[]):Promise<RaffleClaimFacts[]>{
  const claims=await Promise.all(ids.map(getRaffleClaim));
  return claims.filter((claim):claim is RaffleClaimFacts=>claim!==null);
}

export async function raffleClaimFactsForRaffle(raffleId:string):Promise<RaffleClaimFacts[]>{
  const guildId=(await requireOperationalInstallationGuildBinding()).guildId;
  const result=await pool.query<{claim_id:string}>(
    `SELECT rc.claim_id FROM raffle_claims rc JOIN raffles r ON r.raffle_id=rc.raffle_id AND r.guild_id=$2
       WHERE rc.raffle_id=$1 ORDER BY rc.created_at_unix ASC,rc.claim_id ASC`,[raffleId,guildId]);
  return claimFactsForIds(result.rows.map(row=>String(row.claim_id)));
}

export async function raffleClaimFactsForMember(guildieId:string,raffleId:string):Promise<RaffleClaimFacts[]>{
  const guildId=(await requireOperationalInstallationGuildBinding()).guildId;
  const result=await pool.query<{claim_id:string;created_at_unix:string}>(
    `SELECT rc.claim_id,rc.created_at_unix FROM raffle_claims rc JOIN raffles r ON r.raffle_id=rc.raffle_id AND r.guild_id=$2
       WHERE rc.raffle_id=$1 ORDER BY rc.created_at_unix DESC,rc.claim_id DESC`,
    [raffleId,guildId]);
  const claimIds=result.rows.map(row=>String(row.claim_id));
  const client=await pool.connect();
  try {
    const offers=await activityParticipationOffersForActivity(client,{
      activityKind:"raffle",
      activityId:raffleId,
      procedureReferences:claimIds,
    });
    const memberClaimIds=new Set(
      offers
        .filter((offer)=>offer.actor.kind==="native"&&offer.actor.reference===guildieId)
        .map((offer)=>offer.procedureReference),
    );
    return claimFactsForIds(claimIds.filter((claimId)=>memberClaimIds.has(claimId)));
  } finally {
    client.release();
  }
}

async function raffleFactsForIds(ids:string[]):Promise<RaffleFacts[]>{
  const raffles=await Promise.all(ids.map(raffleFacts));
  return raffles.filter((raffle):raffle is RaffleFacts=>raffle!==null);
}

export async function raffleFactsForOperation():Promise<RaffleFacts[]>{
  const guildId=(await requireOperationalInstallationGuildBinding()).guildId;
  const result=await pool.query<{raffle_id:string}>(
    `SELECT raffle_id FROM raffles WHERE guild_id=$1 AND conclusion IS NULL
       ORDER BY drawing_at_unix ASC,created_at_unix ASC,raffle_id ASC`,[guildId]);
  return raffleFactsForIds(result.rows.map(row=>String(row.raffle_id)));
}

export async function concludedRaffleFacts():Promise<RaffleFacts[]>{
  const guildId=(await requireOperationalInstallationGuildBinding()).guildId;
  const result=await pool.query<{raffle_id:string}>(
    `SELECT raffle_id FROM raffles WHERE guild_id=$1 AND conclusion IS NOT NULL
       ORDER BY concluded_at_unix DESC NULLS LAST,raffle_id DESC`,[guildId]);
  return raffleFactsForIds(result.rows.map(row=>String(row.raffle_id)));
}

export async function openRaffleFacts():Promise<RaffleFacts[]>{
  const operational=await raffleFactsForOperation();
  return operational.filter(facts=>facts.participationOpen);
}


// Canonical claim ledger reads Participation Offers for both native and external actors.
// A declared character remains text; it is never promoted to a recognized Character.
export type RaffleLedgerClaim = {
  claimId: string;
  actorKind: "native" | "external";
  actorReference: string;
  characterDesignation: string;
  characterProvenance: "recognized" | "declared";
  requestedEntryCount: number;
  promisedGoldValue: string;
  createdAtUnix: number;
  resolutionKind: RaffleClaimResolution;
  approvedByIdentityId: string | null;
  deniedByIdentityId: string | null;
  revokedByIdentityId: string | null;
  denialReason: string | null;
  resolvedAtUnix: number | null;
};

export async function raffleClaimLedger(raffleId: string): Promise<RaffleLedgerClaim[]> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  const result = await pool.query<{
    claim_id: string; promised_gold_value: string; created_at_unix: string;
    resolution_kind: RaffleClaimResolution; approved_by_identity_id: string | null;
    approved_at_unix: string | null; denied_by_identity_id: string | null;
    denied_at_unix: string | null; revoked_by_identity_id: string | null; revoked_at_unix: string | null; denial_reason: string | null;
  }>(
    `SELECT c.claim_id,c.promised_gold_value,c.created_at_unix,c.resolution_kind,
            c.approved_by_identity_id,c.approved_at_unix,c.denied_by_identity_id,
            c.denied_at_unix,c.revoked_by_identity_id,c.revoked_at_unix,c.denial_reason
       FROM raffle_claims c JOIN raffles r ON r.raffle_id=c.raffle_id
      WHERE c.raffle_id=$1 AND r.guild_id=$2
      ORDER BY c.created_at_unix ASC,c.claim_id ASC`,
    [raffleId, guildId],
  );
  if (!result.rows.length) return [];
  const client = await pool.connect();
  try {
    const offers = await activityParticipationOffersForActivity(client, {
      activityKind: "raffle", activityId: raffleId,
      procedureReferences: result.rows.map((row) => row.claim_id),
    });
    const byClaimId = new Map(offers.map((offer) => [offer.procedureReference, offer]));
    return result.rows.map((row) => {
      const offer = byClaimId.get(row.claim_id);
      if (!offer) throw new Error(`Raffle claim ${row.claim_id} is missing its Participation Offer`);
      const character = offer.context.find((item) => item.name === "character")?.value;
      const claim = offer.context.find((item) => item.name === "claim")?.value;
      if (!character || !claim || Array.isArray(character) || Array.isArray(claim)) {
        throw new Error(`Raffle claim ${row.claim_id} has invalid Participation Offer context`);
      }
      const characterValue = character as ActivitySharedValue;
      const claimValue = claim as ActivitySharedValue;
      if (claimValue.type !== "integer" ||
          (characterValue.type !== "string" && characterValue.type !== "guild_character")) {
        throw new Error(`Raffle claim ${row.claim_id} has invalid Participation Offer context`);
      }
      return {
        claimId: row.claim_id,
        actorKind: offer.actor.kind,
        actorReference: offer.actor.reference,
        characterDesignation: characterValue.type === "string" ? characterValue.value : characterValue.value.name,
        characterProvenance: characterValue.type === "string" ? "declared" as const : "recognized" as const,
        requestedEntryCount: claimValue.value,
        promisedGoldValue: row.promised_gold_value,
        createdAtUnix: Number(row.created_at_unix),
        resolutionKind: row.resolution_kind,
        approvedByIdentityId: row.approved_by_identity_id,
        deniedByIdentityId: row.denied_by_identity_id,
        revokedByIdentityId: row.revoked_by_identity_id,
        denialReason: row.denial_reason,
        resolvedAtUnix: row.resolution_kind === "approved" ? Number(row.approved_at_unix)
          : row.resolution_kind === "denied" ? Number(row.denied_at_unix)
          : row.resolution_kind === "revoked" ? Number(row.revoked_at_unix) : null,
      };
    });
  } finally {
    client.release();
  }
}
