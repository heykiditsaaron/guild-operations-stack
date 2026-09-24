import { raffleParticipationIsOpen, type Raffle } from "./domain.js";

export type RaffleDestination = { kind: string; label: string; href: string };

export function rafflePublicDestination(raffleId:string):string{return `/activities/raffle/${encodeURIComponent(raffleId)}`;}
export function raffleParticipationDestination(raffleId:string):string{return `/activities/raffle/enter?raffle=${encodeURIComponent(raffleId)}`;}
export function raffleOperationDestination(raffleId:string):string{return `/activities/raffle/manage/${encodeURIComponent(raffleId)}`;}

export function raffleDestinations(raffle:Pick<Raffle,"raffleId"|"conclusion"|"openedAtUnix"|"participationPausedAtUnix"|"participationResumedAtUnix"|"drawingAtUnix">):readonly RaffleDestination[]{
  const publicDestination:RaffleDestination={kind:"public",label:"View raffle",href:rafflePublicDestination(raffle.raffleId)};
  if(raffle.conclusion!==null)return [publicDestination];
  const operateDestination:RaffleDestination={kind:"operate",label:"Manage raffle",href:raffleOperationDestination(raffle.raffleId)};
  if(raffleParticipationIsOpen(raffle))return [{kind:"participate",label:"Enter raffle",href:raffleParticipationDestination(raffle.raffleId)},publicDestination,operateDestination];
  return [publicDestination,operateDestination];
}
