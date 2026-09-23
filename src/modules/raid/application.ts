import type { PoolClient } from "pg";
import { characterMembership } from "../../core/guild/character-membership.js";
import { config } from "../../config.js";
import { controlledCharactersForGuildie } from "../../core/identity/controlled-characters.js";
import { pool, withTransaction } from "../../db.js";
import { deliverEmission, publishEmission } from "../../emissions/registry.js";
import {
  effectiveGuildAuthority,
  RAID_ASSIGN_CAPABILITY,
  RAID_MODIFY_CAPABILITY,
  RAID_STAGE_CAPABILITY,
  requireGuildCapabilityOrOperator,
} from "../../core/authority/guild-permissions.js";
import { positionForSpec, traitsForSpec, type WowTrait } from "../../wow-traits/registry.js";
import {
  normalizedRaidRequirements,
  normalizedStrings,
  rolesForParticipationSpecs,
  validateEstablishRaidInput,
  validateModifyRaidInput,
  validateSelectedConfiguration,
  type EstablishRaidAssignmentInput,
  type ModifyRaidAssignmentInput,
  type DenyRaidSignupInput,
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
  cancelledAtUnix: number | null;
  cancelledByGuildieId: string | null;
};
export type RaidRosterDiagnostics = { assigned:number; tanks:number; healers:number; damage:number; melee:number; ranged:number };

export type RaidCalendarProjection = {
  title: string;
  description: string | null;
  category: "raid";
  publicAction: { label: string; href: string };
  participationAction: { label: string; href: string } | null;
  operationAction: { label: string; href: string };
};

type RaidAction = "created" | "modified" | "assignment_established" | "assignment_modified" | "assignment_withdrawn" | "signup_denied";

function nowUnix():number { return Math.floor(Date.now()/1000); }
export const RAID_OPERATIONAL_BUFFER_SECONDS = 60 * 60;
export function raidHasOccurred(raid:RaidEventFacts, atUnix:number=nowUnix()):boolean { return atUnix>=raid.occursAt[0]; }
export function raidSignupCutoffUnix(raid:Pick<RaidEventFacts, "occursAt">):number { return raid.occursAt[0]-RAID_OPERATIONAL_BUFFER_SECONDS; }
export function raidSignupsAreOpen(raid:Pick<RaidEventFacts, "occursAt">, atUnix:number=nowUnix()):boolean { return atUnix<raidSignupCutoffUnix(raid); }
function requireRaidSignupsOpen(raid:RaidEventFacts):void { if(!raidSignupsAreOpen(raid))throw new Error("Raid signups are frozen"); }
function requireUpcomingRaid(raid:RaidEventFacts):void { if(raidHasOccurred(raid))throw new Error("Raid has already occurred"); }
function requireFullOperationalBuffer(occursAt:readonly [number]|readonly [number,number]):void { if(occursAt[0]-nowUnix()<RAID_OPERATIONAL_BUFFER_SECONDS)throw new Error("Raid occurrence must preserve the full operational buffer"); }

function raidPublicDestination(raidId:string):string { return `/events/raid/${encodeURIComponent(raidId)}`; }
function raidParticipationDestination(raidId:string):string { return `/events/raid/${encodeURIComponent(raidId)}/participation`; }
function raidManageDestination(raidId:string):string { return `/events/raid/manage/${encodeURIComponent(raidId)}`; }
export type RaidDestination = { kind: string; label: string; href: string };
export function raidOccurrenceDestinations(raidId:string):readonly RaidDestination[] {
  return [
    { kind:"public", label:"View raid", href:raidPublicDestination(raidId) },
    { kind:"participate", label:"Signups", href:raidParticipationDestination(raidId) },
    { kind:"operate", label:"Manage raid", href:raidManageDestination(raidId) },
  ];
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

export async function raidCalendarProjection(raidId:string):Promise<RaidCalendarProjection|null>{
  const raid=await raidEventFacts(raidId);
  if(!raid)return null;
  return {
    title:raid.label,
    description:raid.description,
    category:"raid",
    publicAction:{label:"View raid",href:raidPublicDestination(raid.raidId)},
    participationAction:raidSignupsAreOpen(raid)?{label:"Sign up",href:raidParticipationDestination(raid.raidId)}:null,
    operationAction:{label:"Manage raid",href:raidManageDestination(raid.raidId)},
  };
}

async function loadRaidEventFacts(raidId:string, client:PoolClient|null, includeCancelled:boolean):Promise<RaidEventFacts|null>{
  const db=client??pool;
  const r=await db.query<any>(`SELECT raid_id,guild_id,label,description,occurs_start_unix,occurs_end_unix,tags,eligibility,difficulty,cancelled_at_unix,cancelled_by_guildie_id FROM raid_events WHERE raid_id=$1 AND ($2::boolean OR cancelled_at_unix IS NULL)`,[raidId,includeCancelled]);
  const x=r.rows[0]; if(!x)return null;
  const requirements=await db.query<{label:string;value:string}>("SELECT label,value FROM raid_requirements WHERE raid_id=$1 ORDER BY position",[raidId]);
  const s=Number(x.occurs_start_unix),e=x.occurs_end_unix===null?null:Number(x.occurs_end_unix);
  return {raidId:x.raid_id,guildId:x.guild_id,label:x.label,description:x.description,occursAt:e===null?[s]:[s,e],tags:x.tags,eligibility:x.eligibility,difficulty:x.difficulty,requirements:requirements.rows,cancelledAtUnix:x.cancelled_at_unix===null?null:Number(x.cancelled_at_unix),cancelledByGuildieId:x.cancelled_by_guildie_id};
}
export async function raidEventFacts(raidId:string, client:PoolClient|null=null):Promise<RaidEventFacts|null>{return loadRaidEventFacts(raidId,client,false);}
export async function raidEventFactsIncludingCancelled(raidId:string, client:PoolClient|null=null):Promise<RaidEventFacts|null>{return loadRaidEventFacts(raidId,client,true);}

export async function establishRaid(actorGuildieId:string,input:EstablishRaidInput):Promise<RaidEventFacts>{
  validateEstablishRaidInput(input); requireFullOperationalBuffer(input.occursAt); await requireGuildCapabilityOrOperator(actorGuildieId,RAID_MODIFY_CAPABILITY); const tags=normalizedStrings(input.tags??["raid"]);
  const persisted = await withTransaction(async client=>{
    const r=await client.query<{raid_id:string}>(`INSERT INTO raid_events (guild_id,label,description,occurs_start_unix,occurs_end_unix,tags,eligibility,difficulty,created_by_guildie_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING raid_id`,[config.guild.id,input.label.trim(),input.description?.trim()||null,input.occursAt[0],input.occursAt.length===2?input.occursAt[1]:null,tags,input.eligibility,input.difficulty,actorGuildieId]);
    const raidId=r.rows[0].raid_id;
    await replaceRaidRequirements(client,raidId,input.requirements??[]);
    await recordRaidAction(client,raidId,"created",actorGuildieId);
    const facts=await raidEventFacts(raidId,client); if(!facts)throw new Error("Created Raid could not be reloaded");
    const publication=await publishEmission(client,{ code:"raid.established", subject:facts.raidId });
    return { raid:facts, publication };
  });
  await deliverEmission(persisted.publication);
  return persisted.raid;
}

export async function modifyRaid(actorGuildieId:string,raidId:string,input:ModifyRaidInput):Promise<RaidEventFacts>{
  validateModifyRaidInput(input); await requireGuildCapabilityOrOperator(actorGuildieId,RAID_MODIFY_CAPABILITY);
  const persisted = await withTransaction(async client=>{
    const current=await raidEventFacts(raidId,client); if(!current)throw new Error("Raid not found"); requireUpcomingRaid(current);
    const occurs=input.occursAt??current.occursAt;
    if(input.occursAt!==undefined)requireFullOperationalBuffer(occurs);
    await client.query(`UPDATE raid_events SET label=$2,description=$3,occurs_start_unix=$4,occurs_end_unix=$5,tags=$6,difficulty=$7,updated_at_unix=extract(epoch FROM now())::bigint WHERE raid_id=$1`,[
      raidId,input.label?.trim()??current.label,input.description===undefined?current.description:(input.description?.trim()||null),occurs[0],occurs.length===2?occurs[1]:null,input.tags===undefined?current.tags:normalizedStrings(input.tags),input.difficulty??current.difficulty]);
    if(input.requirements!==undefined)await replaceRaidRequirements(client,raidId,input.requirements);
    await recordRaidAction(client,raidId,"modified",actorGuildieId);
    const facts=await raidEventFacts(raidId,client); if(!facts)throw new Error("Raid not found");
    const publication=await publishEmission(client,{ code:"raid.modified", subject:facts.raidId });
    return { raid:facts, publication };
  });
  await deliverEmission(persisted.publication);
  return persisted.raid;
}

export async function cancelRaid(actorGuildieId:string,raidId:string):Promise<void>{
  await requireGuildCapabilityOrOperator(actorGuildieId,RAID_STAGE_CAPABILITY);
  const publication=await withTransaction(async client=>{const current=await raidEventFacts(raidId,client);if(!current)throw new Error("Raid not found");requireUpcomingRaid(current);await client.query("UPDATE raid_events SET cancelled_at_unix=extract(epoch FROM now())::bigint,cancelled_by_guildie_id=$2,updated_at_unix=extract(epoch FROM now())::bigint WHERE raid_id=$1",[raidId,actorGuildieId]);return publishEmission(client,{ code:"raid.cancelled", subject:raidId });});
  await deliverEmission(publication);
}

async function assertApplicantEligible(raid:RaidEventFacts,guildieId:string|null):Promise<void>{if(raid.eligibility==="anyone")return;if(!guildieId)throw new Error("Raid eligibility requires a Guildie");if(!await effectiveGuildAuthority(guildieId,raid.guildId))throw new Error("Applicant is not a current Guildie");}
async function participationClass(raid:RaidEventFacts,guildieId:string|null,input:EstablishRaidSignupInput):Promise<{className:string;character:{region:string;realmId:string;characterId:string}|null}>{if("declaredClass" in input.participationKey){if(raid.eligibility!=="anyone")throw new Error("Declared-class rows are only valid for anyone eligibility");const className=input.participationKey.declaredClass.trim();if(!className)throw new Error("Declared class is required");return{className,character:null};}if(!guildieId)throw new Error("Character rows require a resolved Guildie");const coordinate=input.participationKey.character;const characters=await controlledCharactersForGuildie(guildieId);const character=characters.find(c=>c.region===coordinate.region&&c.realmId===coordinate.realmId&&c.characterId===coordinate.characterId);if(!character)throw new Error("Character is not currently controlled by the applicant");if(!character.className)throw new Error("Character class facts are not available");if(raid.eligibility==="guild_character_member"&&!await characterMembership({guildId:raid.guildId,region:character.region,realmId:character.realmId,characterId:character.characterId}))throw new Error("Character is not a current member of the guild roster");return{className:character.className,character:{region:character.region,realmId:character.realmId,characterId:character.characterId}};}
export async function establishRaidSignup(input:EstablishRaidSignupInput):Promise<string>{const raid=await raidEventFacts(input.raidId);if(!raid)throw new Error("Raid not found");requireRaidSignupsOpen(raid);const gid=await resolveApplicantGuildie(input.applicantAnchor);await assertApplicantEligible(raid,gid);const p=await participationClass(raid,gid,input);const specs=normalizedStrings(input.willingSpecs),roles=rolesForParticipationSpecs(p.className,specs);const persisted=await withTransaction(async client=>{const a=await client.query<{applicant_id:string}>(`INSERT INTO raid_applicants (raid_id,anchor_kind,anchor_value,resolved_guildie_id) VALUES ($1,$2,$3,$4) ON CONFLICT (raid_id,anchor_kind,anchor_value) DO UPDATE SET resolved_guildie_id=COALESCE(EXCLUDED.resolved_guildie_id,raid_applicants.resolved_guildie_id) RETURNING applicant_id`,[input.raidId,input.applicantAnchor.kind,input.applicantAnchor.value,gid]);const applicantId=a.rows[0].applicant_id;const r=p.character?await client.query<{signup_row_id:string}>(`INSERT INTO raid_signup_rows (raid_id,applicant_id,character_region,character_realm_id,character_id,declared_class,willing_specs,willing_roles) VALUES ($1,$2,$3,$4,$5,NULL,$6,$7) ON CONFLICT (raid_id,applicant_id,character_region,character_realm_id,character_id) WHERE withdrawn_at_unix IS NULL AND character_id IS NOT NULL DO UPDATE SET willing_specs=EXCLUDED.willing_specs,willing_roles=EXCLUDED.willing_roles,updated_at_unix=extract(epoch FROM now())::bigint RETURNING signup_row_id`,[input.raidId,applicantId,p.character.region,p.character.realmId,p.character.characterId,specs,roles]):await client.query<{signup_row_id:string}>(`INSERT INTO raid_signup_rows (raid_id,applicant_id,character_region,character_realm_id,character_id,declared_class,willing_specs,willing_roles) VALUES ($1,$2,NULL,NULL,NULL,$3,$4,$5) ON CONFLICT (raid_id,applicant_id,declared_class) WHERE withdrawn_at_unix IS NULL AND declared_class IS NOT NULL DO UPDATE SET willing_specs=EXCLUDED.willing_specs,willing_roles=EXCLUDED.willing_roles,updated_at_unix=extract(epoch FROM now())::bigint RETURNING signup_row_id`,[input.raidId,applicantId,p.className,specs,roles]);const publication=await publishEmission(client,{code:"raid.signup.established",subject:input.raidId});return{signupRowId:r.rows[0].signup_row_id,publication};});await deliverEmission(persisted.publication);return persisted.signupRowId;}

export async function revokeRaidSignup(input:RevokeRaidSignupInput):Promise<void>{const publication=await withTransaction(async client=>{const raid=await raidEventFacts(input.raidId,client);if(!raid)throw new Error("Raid not found");requireRaidSignupsOpen(raid);const row=await client.query<{signup_row_id:string}>(`SELECT rr.signup_row_id FROM raid_signup_rows rr JOIN raid_applicants ra ON ra.applicant_id=rr.applicant_id WHERE rr.raid_id=$1 AND rr.signup_row_id=$2 AND ra.anchor_kind=$3 AND ra.anchor_value=$4 AND rr.withdrawn_at_unix IS NULL FOR UPDATE OF rr`,[input.raidId,input.signupRowId,input.applicantAnchor.kind,input.applicantAnchor.value]);if(!row.rowCount)throw new Error("Active Raid signup not found for applicant");await client.query("DELETE FROM raid_assignments WHERE raid_id=$1 AND signup_row_id=$2",[input.raidId,input.signupRowId]);await client.query("UPDATE raid_signup_rows SET withdrawn_at_unix=extract(epoch FROM now())::bigint,updated_at_unix=extract(epoch FROM now())::bigint WHERE raid_id=$1 AND signup_row_id=$2",[input.raidId,input.signupRowId]);return publishEmission(client,{code:"raid.signup.revoked",subject:input.raidId});});await deliverEmission(publication);}

async function raidAssignmentCandidate(client:PoolClient,raidId:string,signupRowId:string):Promise<any>{
  const rr=await client.query<any>(`SELECT rr.applicant_id,rr.willing_specs,rr.declared_class,wcp.class_name
    FROM raid_signup_rows rr
    LEFT JOIN wow_character_profiles wcp ON wcp.region=rr.character_region AND wcp.realm_id=rr.character_realm_id AND wcp.character_id=rr.character_id
    LEFT JOIN raid_signup_denials rsd ON rsd.raid_id=rr.raid_id AND rsd.signup_row_id=rr.signup_row_id
    WHERE rr.raid_id=$1 AND rr.signup_row_id=$2 AND rr.withdrawn_at_unix IS NULL AND rsd.signup_row_id IS NULL`,[raidId,signupRowId]);
  const row=rr.rows[0];if(!row)throw new Error("Raid signup is not available for assignment");return row;
}
export async function setRaidAssignment(actorGuildieId:string,input:EstablishRaidAssignmentInput):Promise<{ assignmentId:string; established:boolean }>{
  await requireGuildCapabilityOrOperator(actorGuildieId,RAID_ASSIGN_CAPABILITY);
  const persisted=await withTransaction(async client=>{
    const raid=await raidEventFacts(input.raidId,client);if(!raid)throw new Error("Raid not found");requireUpcomingRaid(raid);
    const row=await raidAssignmentCandidate(client,input.raidId,input.signupRowId);const cls=row.class_name??row.declared_class;if(!cls)throw new Error("Raid signup class facts are unavailable");validateSelectedConfiguration(cls,row.willing_specs,input.selectedSpec,input.selectedRole);
    const existing=await client.query<{assignment_id:string}>(`SELECT assignment_id FROM raid_assignments WHERE raid_id=$1 AND signup_row_id=$2 FOR UPDATE`,[input.raidId,input.signupRowId]);
    if(existing.rowCount){await client.query(`UPDATE raid_assignments SET selected_spec=$3,selected_role=$4,assigned_by_guildie_id=$5,assigned_at_unix=extract(epoch FROM now())::bigint WHERE raid_id=$1 AND signup_row_id=$2`,[input.raidId,input.signupRowId,input.selectedSpec,input.selectedRole,actorGuildieId]);await recordRaidAction(client,input.raidId,"assignment_modified",actorGuildieId);return{result:{assignmentId:existing.rows[0].assignment_id,established:false},publication:await publishEmission(client,{code:"raid.assignment.modified",subject:input.raidId})};}
    const r=await client.query<{assignment_id:string}>(`INSERT INTO raid_assignments (raid_id,applicant_id,signup_row_id,selected_spec,selected_role,assigned_by_guildie_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING assignment_id`,[input.raidId,row.applicant_id,input.signupRowId,input.selectedSpec,input.selectedRole,actorGuildieId]);await recordRaidAction(client,input.raidId,"assignment_established",actorGuildieId);return{result:{assignmentId:r.rows[0].assignment_id,established:true},publication:await publishEmission(client,{code:"raid.assignment.established",subject:input.raidId})};
  });await deliverEmission(persisted.publication);return persisted.result;
}
export async function establishRaidAssignment(actorGuildieId:string,input:EstablishRaidAssignmentInput):Promise<string>{await requireGuildCapabilityOrOperator(actorGuildieId,RAID_ASSIGN_CAPABILITY);const persisted=await withTransaction(async client=>{const raid=await raidEventFacts(input.raidId,client);if(!raid)throw new Error("Raid not found");requireUpcomingRaid(raid);const row=await raidAssignmentCandidate(client,input.raidId,input.signupRowId);const cls=row.class_name??row.declared_class;if(!cls)throw new Error("Raid signup class facts are unavailable");validateSelectedConfiguration(cls,row.willing_specs,input.selectedSpec,input.selectedRole);const r=await client.query<{assignment_id:string}>(`INSERT INTO raid_assignments (raid_id,applicant_id,signup_row_id,selected_spec,selected_role,assigned_by_guildie_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (raid_id,signup_row_id) DO NOTHING RETURNING assignment_id`,[input.raidId,row.applicant_id,input.signupRowId,input.selectedSpec,input.selectedRole,actorGuildieId]);if(!r.rowCount)throw new Error("Raid assignment already exists");await recordRaidAction(client,input.raidId,"assignment_established",actorGuildieId);return{assignmentId:r.rows[0].assignment_id,publication:await publishEmission(client,{code:"raid.assignment.established",subject:input.raidId})};});await deliverEmission(persisted.publication);return persisted.assignmentId;}
export async function modifyRaidAssignment(actorGuildieId:string,input:ModifyRaidAssignmentInput):Promise<void>{await requireGuildCapabilityOrOperator(actorGuildieId,RAID_ASSIGN_CAPABILITY);const publication=await withTransaction(async client=>{const raid=await raidEventFacts(input.raidId,client);if(!raid)throw new Error("Raid not found");requireUpcomingRaid(raid);const row=await raidAssignmentCandidate(client,input.raidId,input.signupRowId);const cls=row.class_name??row.declared_class;if(!cls)throw new Error("Raid signup class facts are unavailable");validateSelectedConfiguration(cls,row.willing_specs,input.selectedSpec,input.selectedRole);const r=await client.query(`UPDATE raid_assignments SET selected_spec=$3,selected_role=$4,assigned_by_guildie_id=$5,assigned_at_unix=extract(epoch FROM now())::bigint WHERE raid_id=$1 AND signup_row_id=$2`,[input.raidId,input.signupRowId,input.selectedSpec,input.selectedRole,actorGuildieId]);if(!r.rowCount)throw new Error("Raid assignment not found");await recordRaidAction(client,input.raidId,"assignment_modified",actorGuildieId);return publishEmission(client,{code:"raid.assignment.modified",subject:input.raidId});});await deliverEmission(publication);}
export async function withdrawRaidAssignment(actorGuildieId:string,raidId:string,signupRowId:string):Promise<void>{await requireGuildCapabilityOrOperator(actorGuildieId,RAID_ASSIGN_CAPABILITY);const publication=await withTransaction(async client=>{const raid=await raidEventFacts(raidId,client);if(!raid)throw new Error("Raid not found");requireUpcomingRaid(raid);const r=await client.query("DELETE FROM raid_assignments WHERE raid_id=$1 AND signup_row_id=$2",[raidId,signupRowId]);if(!r.rowCount)throw new Error("Raid assignment not found");await recordRaidAction(client,raidId,"assignment_withdrawn",actorGuildieId);return publishEmission(client,{code:"raid.assignment.withdrawn",subject:raidId});});await deliverEmission(publication);}
export async function denyRaidSignup(actorGuildieId:string,input:DenyRaidSignupInput):Promise<void>{await requireGuildCapabilityOrOperator(actorGuildieId,RAID_ASSIGN_CAPABILITY);const publication=await withTransaction(async client=>{const raid=await raidEventFacts(input.raidId,client);if(!raid)throw new Error("Raid not found");requireUpcomingRaid(raid);const signup=await client.query(`SELECT 1 FROM raid_signup_rows WHERE raid_id=$1 AND signup_row_id=$2 AND withdrawn_at_unix IS NULL`,[input.raidId,input.signupRowId]);if(!signup.rowCount)throw new Error("Raid signup not found");const assigned=await client.query(`SELECT 1 FROM raid_assignments WHERE raid_id=$1 AND signup_row_id=$2`,[input.raidId,input.signupRowId]);if(assigned.rowCount)throw new Error("Assigned Raid signup cannot be denied");const r=await client.query(`INSERT INTO raid_signup_denials (raid_id,signup_row_id,denied_by_guildie_id) VALUES ($1,$2,$3) ON CONFLICT (raid_id,signup_row_id) DO NOTHING RETURNING signup_row_id`,[input.raidId,input.signupRowId,actorGuildieId]);if(!r.rowCount)throw new Error("Raid signup is already denied");await recordRaidAction(client,input.raidId,"signup_denied",actorGuildieId);return publishEmission(client,{code:"raid.signup.denied",subject:input.raidId});});await deliverEmission(publication);}
export async function raidRosterDiagnostics(raidId:string):Promise<RaidRosterDiagnostics>{const r=await pool.query<any>(`SELECT ra.selected_role,ra.selected_spec,rr.declared_class,wcp.class_name FROM raid_assignments ra JOIN raid_signup_rows rr ON rr.signup_row_id=ra.signup_row_id LEFT JOIN wow_character_profiles wcp ON wcp.region=rr.character_region AND wcp.realm_id=rr.character_realm_id AND wcp.character_id=rr.character_id WHERE ra.raid_id=$1 AND rr.withdrawn_at_unix IS NULL`,[raidId]);return r.rows.reduce((d:RaidRosterDiagnostics,row:any)=>{d.assigned++;if(row.selected_role==="tank")d.tanks++;if(row.selected_role==="healer")d.healers++;if(row.selected_role==="damage"){d.damage++;const c=row.class_name??row.declared_class,p=c?positionForSpec(c,row.selected_spec):null;if(p==="melee")d.melee++;if(p==="ranged")d.ranged++;}return d;},{assigned:0,tanks:0,healers:0,damage:0,melee:0,ranged:0});}
export async function assignedRaidCapabilities(raidId:string):Promise<readonly WowTrait[]>{const r=await pool.query<any>(`SELECT ra.selected_spec,rr.declared_class,wcp.class_name FROM raid_assignments ra JOIN raid_signup_rows rr ON rr.signup_row_id=ra.signup_row_id LEFT JOIN wow_character_profiles wcp ON wcp.region=rr.character_region AND wcp.realm_id=rr.character_realm_id AND wcp.character_id=rr.character_id WHERE ra.raid_id=$1 AND rr.withdrawn_at_unix IS NULL ORDER BY ra.assigned_at_unix,ra.assignment_id`,[raidId]);return [...new Set<WowTrait>(r.rows.flatMap((row:any)=>{const c=row.class_name??row.declared_class;return c?traitsForSpec(c,row.selected_spec):[]}))].sort();}
