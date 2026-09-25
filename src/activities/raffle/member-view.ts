import type { RaffleClaimResolution } from "./domain.js";
import { raffleGuildieAttribution } from "./guildie-attribution.js";
import { raffleClaimFactsForMember } from "./queries.js";

export type RaffleMemberClaim={claimId:string;raffleId:string;characterId:string;realmId:string;characterName:string;requestedEntryCount:number;promisedGoldValue:string;createdAtUnix:number;resolutionKind:RaffleClaimResolution;resolutionActorLabel:string|null;denialReason:string|null;};
export async function raffleClaimsForMember(guildieId:string,raffleId:string):Promise<RaffleMemberClaim[]>{
 const claims=await raffleClaimFactsForMember(guildieId,raffleId);
 const ids=new Set(claims.map(c=>c.resolutionActorGuildieId).filter((id):id is string=>id!==null));
 const entries=await Promise.all([...ids].map(async id=>[id,await raffleGuildieAttribution(id)] as const));const byId=new Map(entries);
 return claims.map(c=>({claimId:c.claimId,raffleId:c.raffleId,characterId:c.character.characterId,realmId:c.character.realmId,characterName:c.character.name,requestedEntryCount:c.requestedEntryCount,promisedGoldValue:c.promisedGoldValue,createdAtUnix:c.createdAtUnix,resolutionKind:c.resolutionKind,resolutionActorLabel:c.resolutionActorGuildieId===null?null:byId.get(c.resolutionActorGuildieId)??"Guild officer",denialReason:c.denialReason}));
}
