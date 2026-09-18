import type { GuildEventDestination } from "../../guild-events/publication/contract.js";
import { raffleParticipationIsOpen, type Raffle } from "./domain.js";

export function rafflePublicDestination(raffleId:string):string{return `/events/raffle/${encodeURIComponent(raffleId)}`;}
export function raffleParticipationDestination():string{return "/events/raffle/enter";}
export function raffleOperationDestination(raffleId:string):string{return `/events/raffle/manage/${encodeURIComponent(raffleId)}`;}

export function raffleDestinations(raffle:Pick<Raffle,"raffleId"|"conclusion"|"openedAtUnix"|"participationClosedAtUnix"|"drawingAtUnix">):readonly GuildEventDestination[]{
  const publicDestination:GuildEventDestination={kind:"public",label:"View raffle",href:rafflePublicDestination(raffle.raffleId)};
  if(raffle.conclusion!==null)return [publicDestination];
  const operateDestination:GuildEventDestination={kind:"operate",label:"Manage raffle",href:raffleOperationDestination(raffle.raffleId)};
  if(raffleParticipationIsOpen(raffle))return [{kind:"participate",label:"Enter raffle",href:raffleParticipationDestination()},publicDestination,operateDestination];
  return [publicDestination,operateDestination];
}
