import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { GuildCapabilityDeniedError, requireGuildCapabilityOrOperator } from "../../core/authority/guild-permissions.js";
import { RAFFLE_CLAIMS_CAPABILITY } from "./permissions.js";
import {
  RaffleRuleError, approveRaffleClaim, cancelRaffle, pauseRaffleParticipation, resumeRaffleParticipation, denyRaffleClaim, drawRaffle,
  establishRaffle, establishRaffleClaim, getRaffle, listRaffleClaims, modifyRaffle, openRaffleParticipation,
  revokeRaffleClaim, type RafflePrizeKind, type RaffleTerms,
} from "./application.js";

async function requireGuildie(request:FastifyRequest,reply:FastifyReply):Promise<string|null>{
  const guildie=await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
  if(!guildie){await reply.code(401).send({error:"not_authenticated"});return null;}
  return guildie.guildieId;
}
function bodyObject(value:unknown):Record<string,unknown>{return value&&typeof value==="object"?value as Record<string,unknown>:{};}
function requiredString(value:unknown,field:string):string{if(typeof value!=="string"||!value.trim())throw new RaffleRuleError("invalid_input",`${field} is required`,400);return value.trim();}
function nullableString(value:unknown,field:string):string|null{if(value==null)return null;if(typeof value!=="string")throw new RaffleRuleError("invalid_input",`${field} must be a string`,400);return value.trim()||null;}
function requiredInteger(value:unknown,field:string):number{if(typeof value!=="number"||!Number.isInteger(value))throw new RaffleRuleError("invalid_input",`${field} must be an integer`,400);return value;}
function nullableInteger(value:unknown,field:string):number|null{return value==null?null:requiredInteger(value,field);}
function requiredPrizeKind(value:unknown):RafflePrizeKind{const kind=requiredString(value,"prize_kind");if(kind!=="gold"&&kind!=="item"&&kind!=="other")throw new RaffleRuleError("invalid_input","prize_kind must be gold, item, or other",400);return kind;}
function raffleTerms(body:Record<string,unknown>):RaffleTerms{return {
  title:nullableString(body.title,"title"),drawingAtUnix:requiredInteger(body.drawing_at_unix,"drawing_at_unix"),
  entryPriceGold:requiredInteger(body.entry_price_gold,"entry_price_gold"),prizeKind:requiredPrizeKind(body.prize_kind),
  winnerPercentage:nullableInteger(body.winner_percentage,"winner_percentage"),prizeDescription:nullableString(body.prize_description,"prize_description"),
};}
function sendDomainError(error:unknown,reply:FastifyReply):boolean{
  if(error instanceof GuildCapabilityDeniedError){void reply.code(403).send({error:"guild_capability_required",capability:error.capability});return true;}
  if(error instanceof RaffleRuleError){void reply.code(error.statusCode).send({error:error.code,message:error.message});return true;}
  return false;
}

export async function registerRaffleRoutes(app:FastifyInstance):Promise<void>{
  app.post("/raffle",async(request,reply)=>{const id=await requireGuildie(request,reply);if(!id)return;try{return reply.code(201).send(await establishRaffle(id,raffleTerms(bodyObject(request.body))));}catch(e){if(sendDomainError(e,reply))return;throw e;}});
  app.patch<{Params:{raffleId:string}}>("/raffle/:raffleId",async(request,reply)=>{const id=await requireGuildie(request,reply);if(!id)return;try{return await modifyRaffle(id,request.params.raffleId,raffleTerms(bodyObject(request.body)));}catch(e){if(sendDomainError(e,reply))return;throw e;}});
  app.post<{Params:{raffleId:string}}>("/raffle/:raffleId/participation/open",async(request,reply)=>{const id=await requireGuildie(request,reply);if(!id)return;try{return await openRaffleParticipation(id,request.params.raffleId);}catch(e){if(sendDomainError(e,reply))return;throw e;}});
  app.post<{Params:{raffleId:string}}>("/raffle/:raffleId/participation/pause",async(request,reply)=>{const id=await requireGuildie(request,reply);if(!id)return;try{return await pauseRaffleParticipation(id,request.params.raffleId);}catch(e){if(sendDomainError(e,reply))return;throw e;}});
  app.post<{Params:{raffleId:string}}>("/raffle/:raffleId/participation/resume",async(request,reply)=>{const id=await requireGuildie(request,reply);if(!id)return;try{return await resumeRaffleParticipation(id,request.params.raffleId);}catch(e){if(sendDomainError(e,reply))return;throw e;}});
  app.post<{Params:{raffleId:string}}>("/raffle/:raffleId/cancel",async(request,reply)=>{const id=await requireGuildie(request,reply);if(!id)return;try{return await cancelRaffle(id,request.params.raffleId);}catch(e){if(sendDomainError(e,reply))return;throw e;}});
  app.post<{Params:{raffleId:string}}>("/raffle/:raffleId/draw",async(request,reply)=>{const id=await requireGuildie(request,reply);if(!id)return;try{return await drawRaffle(id,request.params.raffleId);}catch(e){if(sendDomainError(e,reply))return;throw e;}});
  app.get<{Params:{raffleId:string}}>("/raffle/:raffleId",async(request,reply)=>{const id=await requireGuildie(request,reply);if(!id)return;const raffle=await getRaffle(request.params.raffleId);return raffle??reply.code(404).send({error:"raffle_not_found"});});
  app.get<{Params:{raffleId:string}}>("/raffle/:raffleId/claims",async(request,reply)=>{const id=await requireGuildie(request,reply);if(!id)return;try{await requireGuildCapabilityOrOperator(id,RAFFLE_CLAIMS_CAPABILITY);const raffle=await getRaffle(request.params.raffleId);if(!raffle)return reply.code(404).send({error:"raffle_not_found"});return {raffle_id:raffle.raffleId,claims:await listRaffleClaims(raffle.raffleId)};}catch(e){if(sendDomainError(e,reply))return;throw e;}});
  app.post<{Params:{raffleId:string}}>("/raffle/:raffleId/claims",async(request,reply)=>{const id=await requireGuildie(request,reply);if(!id)return;const body=bodyObject(request.body);try{return reply.code(201).send(await establishRaffleClaim(id,request.params.raffleId,requiredString(body.realm_id,"realm_id"),requiredString(body.character_id,"character_id"),requiredInteger(body.entry_count,"entry_count")));}catch(e){if(sendDomainError(e,reply))return;throw e;}});
  app.post<{Params:{claimId:string}}>("/raffle/claims/:claimId/revoke",async(request,reply)=>{const id=await requireGuildie(request,reply);if(!id)return;try{await revokeRaffleClaim(id,request.params.claimId);return reply.code(204).send();}catch(e){if(sendDomainError(e,reply))return;throw e;}});
  app.post<{Params:{claimId:string}}>("/raffle/claims/:claimId/approve",async(request,reply)=>{const id=await requireGuildie(request,reply);if(!id)return;try{await approveRaffleClaim(id,request.params.claimId);return reply.code(204).send();}catch(e){if(sendDomainError(e,reply))return;throw e;}});
  app.post<{Params:{claimId:string}}>("/raffle/claims/:claimId/deny",async(request,reply)=>{const id=await requireGuildie(request,reply);if(!id)return;const body=bodyObject(request.body);try{await denyRaffleClaim(id,request.params.claimId,requiredString(body.reason,"reason"));return reply.code(204).send();}catch(e){if(sendDomainError(e,reply))return;throw e;}});
}
