import type { RaffleClaimResolution, RaffleConclusion, RafflePrizeKind } from "./domain.js";
import { raffleGuildieAttribution } from "./guildie-attribution.js";
import { raffleClaimFactsForRaffle, raffleFacts } from "./queries.js";

export type RafflePublicClaim={claimId:string;characterName:string;requestedEntryCount:number;promisedGoldValue:string;createdAtUnix:number;resolutionKind:RaffleClaimResolution;resolutionActorLabel:string|null;resolvedAtUnix:number|null;denialReason:string|null;};
export type RafflePublicView={raffleId:string;conclusion:RaffleConclusion;title:string|null;drawingAtUnix:number;entryPriceGold:string;prizeKind:RafflePrizeKind;winnerPercentage:number|null;prizeDescription:string|null;createdAtUnix:number;openedAtUnix:number|null;participationClosedAtUnix:number|null;participationOpen:boolean;concludedAtUnix:number|null;totalEntries:number|null;approvedEntryCount:number;winnerCharacterName:string|null;claims:RafflePublicClaim[];};

export async function rafflePublicView(raffleId:string):Promise<RafflePublicView|null>{
 const [facts,claims]=await Promise.all([raffleFacts(raffleId),raffleClaimFactsForRaffle(raffleId)]);if(!facts)return null;
 const ids=new Set(claims.map(c=>c.resolutionActorGuildieId).filter((id):id is string=>id!==null));
 const entries=await Promise.all([...ids].map(async id=>[id,await raffleGuildieAttribution(id)] as const));const byId=new Map(entries);
 return {raffleId:facts.raffle.raffleId,conclusion:facts.raffle.conclusion,title:facts.raffle.title,drawingAtUnix:facts.raffle.drawingAtUnix,entryPriceGold:facts.raffle.entryPriceGold,prizeKind:facts.raffle.prizeKind,winnerPercentage:facts.raffle.winnerPercentage,prizeDescription:facts.raffle.prizeDescription,createdAtUnix:facts.raffle.createdAtUnix,openedAtUnix:facts.raffle.openedAtUnix,participationClosedAtUnix:facts.raffle.participationClosedAtUnix,participationOpen:facts.participationOpen,concludedAtUnix:facts.raffle.concludedAtUnix,totalEntries:facts.raffle.totalEntries,approvedEntryCount:facts.metrics.approvedEntryCount,winnerCharacterName:facts.winner?.character.name??null,claims:claims.map(c=>({claimId:c.claimId,characterName:c.character.name,requestedEntryCount:c.requestedEntryCount,promisedGoldValue:c.promisedGoldValue,createdAtUnix:c.createdAtUnix,resolutionKind:c.resolutionKind,resolutionActorLabel:c.resolutionActorGuildieId===null?null:byId.get(c.resolutionActorGuildieId)??"Guild officer",resolvedAtUnix:c.resolutionAtUnix,denialReason:c.denialReason}))};
}
