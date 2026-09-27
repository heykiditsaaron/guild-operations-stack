import type { Raffle } from "./domain.js";
import { concludedRaffleFacts } from "./queries.js";

export type RaffleHistoryEntry=Raffle&{approvedEntryCount:number;winnerCharacterName:string|null;winnerAvatarUrl:string|null;};
export async function raffleHistory():Promise<RaffleHistoryEntry[]>{
  const raffles=await concludedRaffleFacts();
  return raffles.map(({raffle,metrics,winner})=>({...raffle,approvedEntryCount:metrics.approvedEntryCount,winnerCharacterName:winner?.character.name??null,winnerAvatarUrl:winner?.avatarUrl??null}));
}
export async function latestDrawnRaffleWinner():Promise<RaffleHistoryEntry|null>{
  const raffles=await raffleHistory();return raffles.find(raffle=>raffle.conclusion==="drawn")??null;
}
