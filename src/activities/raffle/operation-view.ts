import type { Raffle } from "./domain.js";
import { raffleFactsForOperation } from "./queries.js";
export type RaffleOperation=Raffle&{participationOpen:boolean;claimCount:number;pendingClaimCount:number;approvedClaimCount:number;revokedClaimCount:number;deniedClaimCount:number;approvedEntryCount:number;};
export async function rafflesForOperation():Promise<RaffleOperation[]>{
 const raffles=await raffleFactsForOperation();
 return raffles.map(({raffle,participationOpen,metrics})=>({...raffle,participationOpen,claimCount:metrics.claimCount,pendingClaimCount:metrics.pendingClaimCount,approvedClaimCount:metrics.approvedClaimCount,revokedClaimCount:metrics.revokedClaimCount,deniedClaimCount:metrics.deniedClaimCount,approvedEntryCount:metrics.approvedEntryCount}));
}
