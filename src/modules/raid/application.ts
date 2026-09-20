import type { PoolClient } from "pg";
import { characterMembership } from "../../application-state.js";
import { config } from "../../config.js";
import { controlledCharactersForGuildie } from "../../controlled-characters.js";
import { pool, withTransaction } from "../../db.js";
import { establishGuildEventPublication, withdrawGuildEventPublication } from "../../guild-events/publication/registry.js";
import type { GuildEventDestination } from "../../guild-events/publication/contract.js";
import {
  effectiveGuildAuthority,
  RAID_ASSIGN_CAPABILITY,
  RAID_MODIFY_CAPABILITY,
  RAID_STAGE_CAPABILITY,
  requireGuildCapabilityOrOperator,
} from "../../guild-permissions.js";
import { positionForSpec, traitsForSpec, type WowTrait } from "../../wow-traits/registry.js";
import {
  normalizedRaidRequirements,
  normalizedStrings,
  rolesForParticipationSpecs,
  validateEstablishRaidInput,
  validateModifyRaidInput,
  validateSelectedConfiguration,
  type EstablishRaidAssignmentInput,
  type EstablishRaidInput,
  type ModifyRaidInput,
  type RaidApplicantAnchor,
  type RaidDifficulty,
  type RaidEligibility,
  type RaidRequirement,
  type RaidRole,
  type EstablishRaidSignupInput,
  type RevokeRaidSignupInput,
} from "./domain.js";

export type RaidEventFacts = {
  raidId: string;
  guildId: string;
  label: string;
  description: string | null;
  occursAt: readonly [number] | readonly [number, number];
  tags: string[];
  eligibility: RaidEligibility;
  difficulty: RaidDifficulty;
  requirements: RaidRequirement[];
};
export type RaidRosterDiagnostics = { assigned:number; tanks:number; healers:number; damage:number; melee:number; ranged:number };

type RaidAction = "created" | "modified" | "assigned" | "unassigned";

function nowUnix():number { return Math.floor(Date.now()/1000); }
export function raidHasOccurred(raid:RaidEventFacts, atUnix:number=nowUnix()):boolean { return atUnix>=raid.occursAt[0]; }
function requireUpcomingRaid(raid:RaidEventFacts):void { if(raidHasOccurred(raid))throw new Error("Raid has already occurred"); }
function requireFutureOccurrence(occursAt:readonly [number]|readonly [number,number]):void { if(occursAt[0]<=nowUnix())throw new Error("Raid occurrence must be in the future"); }

function raidPublicDestination(raidId:string):string { return `/events/raid/${encodeURIComponent(raidId)}`; }
function raidParticipationDestination(raidId:string):string { return `/events/raid/${encodeURIComponent(raidId)}/participation`; }
function raidManageDestination(raidId:string):string { return `/events/raid/manage/${encodeURIComponent(raidId)}`; }
export function raidOccurrenceDestinations(raidId:string):readonly GuildEventDestination[] {
  return [
    { kind:"public", label:"View raid", href:raidPublicDestination(raidId) },
    { kind:"participate", label:"Signups", href:raidParticipationDestination(raidId) },
    { kind:"operate", label:"Manage raid", href:raidManageDestination(raidId) },
  ];
}
async function publishRaid(raid:RaidEventFacts, client:PoolClient):Promise<void> {
  await establishGuildEventPublication({ publicationId:raid.raidId, label:raid.label, description:raid.description, occursAt:[raid.occursAt],
    category:"raid", tags:raid.tags, destinations:raidOccurrenceDestinations(raid.raidId) }, client);
}
async function recordRaidAction(client:PoolClient,raidId:string,action:RaidAction,actorGuildieId:string):Promise<void>{
  await client.query("INSERT INTO raid_action_history (raid_id,action,actor_guildie_id) VALUES ($1,$2,$3)",[raidId,action,actorGuildieId]);
}
async function replaceRaidRequirements(client:PoolClient,raidId:string,requirements:readonly RaidRequirement[]):Promise<void>{
  await client.query("DELETE FROM raid_requirements WHERE raid_id=$1",[raidId]);
  for(const [position,requirement] of normalizedRaidRequirements(requirements).entries()){
    await client.query("INSERT INTO raid_requirements (raid_id,position,label,value) VALUES ($1,$2,$3,$4)",[raidId,position,requirement.label,requirement.value]);
  }
}
async function resolveApplicantGuildie(anchor:RaidApplicantAnchor):Promise<string|null>{ if(anchor.kind!=="guildie")return null; const r=await pool.query<{guildie_id:string}>("SELECT guildie_id FROM guildies WHERE guildie_id = $1",[anchor.value]); return r.rows[0]?.guildie_id??null; }

export async function raidEventFacts(raidId:string, client:PoolClient|null=null):Promise<RaidEventFacts|null>{
  const db=client??pool;
  const r=await db.query<any>(`SELECT raid_id,guild_id,label,description,occurs_start_unix,occurs_end_unix,tags,eligibility,difficulty FROM raid_events WHERE raid_id=$1`,[raidId]);
  const x=r.rows[0]; if(!x)return null;
  const requirements=await db.query<{label:string;value:string}>("SELECT label,value FROM raid_requirements WHERE raid_id=$1 ORDER BY position",[raidId]);
  const s=Number(x.occurs_start_unix),e=x.occurs_end_unix===null?null:Number(x.occurs_end_unix);
  return {raidId:x.raid_id,guildId:x.guild_id,label:x.label,description:x.description,occursAt:e===null?[s]:[s,e],tags:x.tags,eligibility:x.eligibility,difficulty:x.difficulty,requirements:requirements.rows};
}

export async function establishRaid(actorGuildieId:string,input:EstablishRaidInput):Promise<RaidEventFacts>{
  validateEstablishRaidInput(input); requireFutureOccurrence(input.occursAt); await requireGuildCapabilityOrOperator(actorGuildieId,RAID_MODIFY_CAPABILITY); const tags=normalizedStrings(input.tags??["raid"]);
  return withTransaction(async client=>{
    const r=await client.query<{raid_id:string}>(`INSERT INTO raid_events (guild_id,label,description,occurs_start_unix,occurs_end_unix,tags,eligibility,difficulty,created_by_guildie_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING raid_id`,[config.guild.id,input.label.trim(),input.description?.trim()||null,input.occursAt[0],input.occursAt.length===2?input.occursAt[1]:null,tags,input.eligibility,input.difficulty,actorGuildieId]);
    const raidId=r.rows[0].raid_id;
    await replaceRaidRequirements(client,raidId,input.requirements??[]);
    await recordRaidAction(client,raidId,"created",actorGuildieId);
    const facts=await raidEventFacts(raidId,client); if(!facts)throw new Error("Created Raid could not be reloaded"); await publishRaid(facts,client); return facts;
  });
}

export async function modifyRaid(actorGuildieId:string,raidId:string,input:ModifyRaidInput):Promise<RaidEventFacts>{
  validateModifyRaidInput(input); await requireGuildCapabilityOrOperator(actorGuildieId,RAID_MODIFY_CAPABILITY);
  return withTransaction(async client=>{
    const current=await raidEventFacts(raidId,client); if(!current)throw new Error("Raid not found"); requireUpcomingRaid(current);
    const occurs=input.occursAt??current.occursAt; requireFutureOccurrence(occurs);
    await client.query(`UPDATE raid_events SET label=$2,description=$3,occurs_start_unix=$4,occurs_end_unix=$5,tags=$6,difficulty=$7,updated_at_unix=extract(epoch FROM now())::bigint WHERE raid_id=$1`,[
      raidId,input.label?.trim()??current.label,input.description===undefined?current.description:(input.description?.trim()||null),occurs[0],occurs.length===2?occurs[1]:null,input.tags===undefined?current.tags:normalizedStrings(input.tags),input.difficulty??current.difficulty]);
    if(input.requirements!==undefined)await replaceRaidRequirements(client,raidId,input.requirements);
    await recordRaidAction(client,raidId,"modified",actorGuildieId);
    const facts=await raidEventFacts(raidId,client); if(!facts)throw new Error("Raid not found"); await publishRaid(facts,client); return facts;
  });
}

export async function cancelRaid(actorGuildieId:string,raidId:string):Promise<void>{
  await requireGuildCapabilityOrOperator(actorGuildieId,RAID_STAGE_CAPABILITY);
  await withTransaction(async client=>{const current=await raidEventFacts(raidId,client);if(!current)throw new Error("Raid not found");requireUpcomingRaid(current);await withdrawGuildEventPublication(raidId,client);await client.query("DELETE FROM raid_events WHERE raid_id=$1",[raidId]);});
}

async function assertApplicantEligible(raid:RaidEventFacts,guildieId:string|null):Promise<void>{if(raid.eligibility==="anyone")return;if(!guildieId)throw new Error("Raid eligibility requires a Guildie");if(!await effectiveGuildAuthority(guildieId,raid.guildId))throw new Error("Applicant is not a current Guildie");}
async function participationClass(raid:RaidEventFacts,guildieId:string|null,input:EstablishRaidSignupInput):Promise<{className:string;character:{region:string;realmId:string;characterId:string}|null}>{if("declaredClass" in input.participationKey){if(raid.eligibility!=="anyone")throw new Error("Declared-class rows are only valid for anyone eligibility");const className=input.participationKey.declaredClass.trim();if(!className)throw new Error("Declared class is required");return{className,character:null};}if(!guildieId)throw new Error("Character rows require a resolved Guildie");const coordinate=input.participationKey.character;const characters=await controlledCharactersForGuildie(guildieId);const character=characters.find(c=>c.region===coordinate.region&&c.realmId===coordinate.realmId&&c.characterId===coordinate.characterId);if(!character)throw new Error("Character is not currently controlled by the applicant");if(!character.className)throw new Error("Character class facts are not available");if(raid.eligibility==="guild_character_member"&&!await characterMembership({guildId:raid.guildId,region:character.region,realmId:character.realmId,characterId:character.characterId}))throw new Error("Character is not a current member of the guild roster");return{className:character.className,character:{region:character.region,realmId:character.realmId,characterId:character.characterId}};}
export async function establishRaidSignup(input:EstablishRaidSignupInput):Promise<string>{const raid=await raidEventFacts(input.raidId);if(!raid)throw new Error("Raid not found");requireUpcomingRaid(raid);const gid=await resolveApplicantGuildie(input.applicantAnchor);await assertApplicantEligible(raid,gid);const p=await participationClass(raid,gid,input);const specs=normalizedStrings(input.willingSpecs),roles=rolesForParticipationSpecs(p.className,specs);return withTransaction(async client=>{const a=await client.query<{applicant_id:string}>(`INSERT INTO raid_applicants (raid_id,anchor_kind,anchor_value,resolved_guildie_id) VALUES ($1,$2,$3,$4) ON CONFLICT (raid_id,anchor_kind,anchor_value) DO UPDATE SET resolved_guildie_id=COALESCE(EXCLUDED.resolved_guildie_id,raid_applicants.resolved_guildie_id) RETURNING applicant_id`,[input.raidId,input.applicantAnchor.kind,input.applicantAnchor.value,gid]);const r=await client.query<{signup_row_id:string}>(`INSERT INTO raid_signup_rows (raid_id,applicant_id,character_region,character_realm_id,character_id,declared_class,willing_specs,willing_roles) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING signup_row_id`,[input.raidId,a.rows[0].applicant_id,p.character?.region??null,p.character?.realmId??null,p.character?.characterId??null,p.character?null:p.className,specs,roles]);return r.rows[0].signup_row_id;});}

export async function revokeRaidSignup(input:RevokeRaidSignupInput):Promise<void>{await withTransaction(async client=>{const raid=await raidEventFacts(input.raidId,client);if(!raid)throw new Error("Raid not found");requireUpcomingRaid(raid);const row=await client.query<{signup_row_id:string}>(`SELECT rr.signup_row_id FROM raid_signup_rows rr JOIN raid_applicants ra ON ra.applicant_id=rr.applicant_id WHERE rr.raid_id=$1 AND rr.signup_row_id=$2 AND ra.anchor_kind=$3 AND ra.anchor_value=$4 AND rr.withdrawn_at_unix IS NULL FOR UPDATE OF rr`,[input.raidId,input.signupRowId,input.applicantAnchor.kind,input.applicantAnchor.value]);if(!row.rowCount)throw new Error("Active Raid signup not found for applicant");await client.query("DELETE FROM raid_assignments WHERE raid_id=$1 AND signup_row_id=$2",[input.raidId,input.signupRowId]);await client.query("UPDATE raid_signup_rows SET withdrawn_at_unix=extract(epoch FROM now())::bigint,updated_at_unix=extract(epoch FROM now())::bigint WHERE raid_id=$1 AND signup_row_id=$2",[input.raidId,input.signupRowId]);});}

export async function establishRaidAssignment(actorGuildieId:string,input:EstablishRaidAssignmentInput):Promise<string>{await requireGuildCapabilityOrOperator(actorGuildieId,RAID_ASSIGN_CAPABILITY);return withTransaction(async client=>{const raid=await raidEventFacts(input.raidId,client);if(!raid)throw new Error("Raid not found");requireUpcomingRaid(raid);const rr=await client.query<any>(`SELECT rr.applicant_id,rr.willing_specs,rr.declared_class,wcp.class_name FROM raid_signup_rows rr LEFT JOIN wow_character_profiles wcp ON wcp.region=rr.character_region AND wcp.realm_id=rr.character_realm_id AND wcp.character_id=rr.character_id WHERE rr.raid_id=$1 AND rr.signup_row_id=$2 AND rr.withdrawn_at_unix IS NULL`,[input.raidId,input.signupRowId]);const row=rr.rows[0];if(!row)throw new Error("Raid signup not found");const cls=row.class_name??row.declared_class;if(!cls)throw new Error("Raid signup class facts are unavailable");validateSelectedConfiguration(cls,row.willing_specs,input.selectedSpec,input.selectedRole);const r=await client.query<{assignment_id:string}>(`INSERT INTO raid_assignments (raid_id,applicant_id,signup_row_id,selected_spec,selected_role,assigned_by_guildie_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (raid_id,signup_row_id) DO UPDATE SET selected_spec=EXCLUDED.selected_spec,selected_role=EXCLUDED.selected_role,assigned_by_guildie_id=EXCLUDED.assigned_by_guildie_id,assigned_at_unix=extract(epoch FROM now())::bigint RETURNING assignment_id`,[input.raidId,row.applicant_id,input.signupRowId,input.selectedSpec,input.selectedRole,actorGuildieId]);await recordRaidAction(client,input.raidId,"assigned",actorGuildieId);return r.rows[0].assignment_id;});}
export async function withdrawRaidAssignment(actorGuildieId:string,raidId:string,signupRowId:string):Promise<void>{await requireGuildCapabilityOrOperator(actorGuildieId,RAID_ASSIGN_CAPABILITY);await withTransaction(async client=>{const raid=await raidEventFacts(raidId,client);if(!raid)throw new Error("Raid not found");requireUpcomingRaid(raid);const r=await client.query("DELETE FROM raid_assignments WHERE raid_id=$1 AND signup_row_id=$2",[raidId,signupRowId]);if(r.rowCount)await recordRaidAction(client,raidId,"unassigned",actorGuildieId);});}
export async function raidRosterDiagnostics(raidId:string):Promise<RaidRosterDiagnostics>{const r=await pool.query<any>(`SELECT ra.selected_role,ra.selected_spec,rr.declared_class,wcp.class_name FROM raid_assignments ra JOIN raid_signup_rows rr ON rr.signup_row_id=ra.signup_row_id LEFT JOIN wow_character_profiles wcp ON wcp.region=rr.character_region AND wcp.realm_id=rr.character_realm_id AND wcp.character_id=rr.character_id WHERE ra.raid_id=$1 AND rr.withdrawn_at_unix IS NULL`,[raidId]);return r.rows.reduce((d:RaidRosterDiagnostics,row:any)=>{d.assigned++;if(row.selected_role==="tank")d.tanks++;if(row.selected_role==="healer")d.healers++;if(row.selected_role==="damage"){d.damage++;const c=row.class_name??row.declared_class,p=c?positionForSpec(c,row.selected_spec):null;if(p==="melee")d.melee++;if(p==="ranged")d.ranged++;}return d;},{assigned:0,tanks:0,healers:0,damage:0,melee:0,ranged:0});}
export async function assignedRaidCapabilities(raidId:string):Promise<readonly WowTrait[]>{const r=await pool.query<any>(`SELECT ra.selected_spec,rr.declared_class,wcp.class_name FROM raid_assignments ra JOIN raid_signup_rows rr ON rr.signup_row_id=ra.signup_row_id LEFT JOIN wow_character_profiles wcp ON wcp.region=rr.character_region AND wcp.realm_id=rr.character_realm_id AND wcp.character_id=rr.character_id WHERE ra.raid_id=$1 AND rr.withdrawn_at_unix IS NULL ORDER BY ra.assigned_at_unix,ra.assignment_id`,[raidId]);return [...new Set<WowTrait>(r.rows.flatMap((row:any)=>{const c=row.class_name??row.declared_class;return c?traitsForSpec(c,row.selected_spec):[]}))].sort();}
