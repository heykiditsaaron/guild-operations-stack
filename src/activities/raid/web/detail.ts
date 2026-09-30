import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticatedIdentity, SESSION_COOKIE_NAME } from "../../../auth.js";
import { GuildCapabilityDeniedError, identityHasGuildCapabilityOrOperator } from "../../../core/authority/guild-permissions.js";
import { RAID_ASSIGN_CAPABILITY, RAID_MODIFY_CAPABILITY, RAID_STAGE_CAPABILITY } from "../permissions.js";

import {
  setRaidAssignment,
  raidEventFacts,
  raidCommitmentAdjudications,
  adjudicateRaidCommitment,
  concludeRaid,
  raidOccurrenceDestinations,
  raidRosterDiagnostics,
  withdrawRaidAssignment,
} from "../application.js";
import { raidSignups } from "../participation-view.js";
import type { RaidDifficulty, RaidRole } from "../domain.js";
import {
  isRaidBuffTrait,
  raidBuffIconUrl,
  raidBuffLabel,
  specializationIconUrl,
  type RaidBuffTrait,
} from "../../../wow-iconography.js";
import { allWowTraits, specHasTrait, traitsForSpec, type WowTrait } from "../../../wow-traits/registry.js";
import type { AssetName, AssetRegistry } from "../../../web/assets.js";
import { htmlText, renderOccurrenceOperations, renderPage, type SecondaryNavigation } from "../../../web/render.js";
import { viewerForRequest } from "../../../web/viewer.js";

type RaidParams = { raidId: string };
type AssignBody = { signupRowId?: unknown; selectedClass?: unknown; selectedSpec?: unknown; selectedRole?: unknown };
type UnassignBody = { signupRowId?: unknown };
type AdjudicateBody = { signupRowId?: unknown; fulfilled?: unknown };
type RaidSignupView = Awaited<ReturnType<typeof raidSignups>>[number];

const RAID_ROLES: readonly RaidRole[] = ["tank", "healer", "damage"];
const ROLE_TRAITS: Record<RaidRole, WowTrait> = {
  tank: "role.tank",
  healer: "role.healer",
  damage: "role.damage",
};
const RAID_BUFF_TRAITS = allWowTraits().filter(isRaidBuffTrait);
const UTILITY_TRAITS = allWowTraits().filter((trait) => trait.startsWith("effect.") || trait.startsWith("dispel.") || trait.startsWith("control."));
const ARMOR_TRAITS: readonly WowTrait[] = ["armor.cloth", "armor.leather", "armor.mail", "armor.plate"];

function roleLabel(role: RaidRole): string {
  return role === "damage" ? "Damage" : role === "healer" ? "Healer" : "Tank";
}

function difficultyLabel(value: RaidDifficulty): string {
  return value[0].toUpperCase() + value.slice(1);
}

function capabilityLabel(value: string): string {
  return value
    .replaceAll(".", " · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function armorLabel(value: WowTrait): string {
  return value.replace("armor.", "").replace(/\b\w/g, (character) => character.toUpperCase());
}

function specsByRole(row: RaidSignupView): Record<RaidRole, Array<{ className:string; specName:string }>> {
  return {
    tank: row.offeredSpecs.filter((spec) => specHasTrait(spec.className, spec.specName, ROLE_TRAITS.tank)),
    healer: row.offeredSpecs.filter((spec) => specHasTrait(spec.className, spec.specName, ROLE_TRAITS.healer)),
    damage: row.offeredSpecs.filter((spec) => specHasTrait(spec.className, spec.specName, ROLE_TRAITS.damage)),
  };
}

function coverageCount(rows: readonly RaidSignupView[], trait: WowTrait): number {
  return rows.reduce((count, row) => {
    if (!row.selectedSpec) return count;
    return row.selectedClass && traitsForSpec(row.selectedClass, row.selectedSpec).includes(trait) ? count + 1 : count;
  }, 0);
}

async function specIcon(className: string, specName: string, classNameValue: string): Promise<string> {
  const iconUrl = await specializationIconUrl(className, specName);
  if (!iconUrl) return `<span class="raid-spec-icon-fallback">${htmlText(specName)}</span>`;
  return `<img class="raid-spec-icon" src="${htmlText(iconUrl)}" alt="" aria-hidden="true" title="${htmlText(`${specName} ${classNameValue}`)}">`;
}

function offeredRoleIcons(row: RaidSignupView): string {
  const roleSpecs = specsByRole(row);
  const roles = RAID_ROLES.filter((role) => roleSpecs[role].length > 0);
  if (!roles.length) return "";
  return `<div class="raid-participant-roles" aria-label="Offered roles">${roles.map((role) => `<span class="raid-role-icon raid-role-icon-${role}" role="img" aria-label="${htmlText(roleLabel(role))}" title="${htmlText(roleLabel(role))}"></span>`).join("")}</div>`;
}

async function signupCard(row: RaidSignupView): Promise<string> {
  const roleSpecs = specsByRole(row);
  return `<article class="raid-participant-card" draggable="true" tabindex="0"
    data-raid-participant-card
    data-assigned="false"
    data-signup-row-id="${htmlText(row.signupRowId)}"
    data-role-specs="${htmlText(JSON.stringify(roleSpecs))}">
    <div class="raid-participant-card-copy">
      <strong>${htmlText(row.displayName)}</strong>
      <span>${row.offeredSpecs.map((spec) => htmlText(`${spec.specName} ${spec.className}`)).join(", ")}</span>
    </div>
    ${offeredRoleIcons(row)}
  </article>`;
}

async function assignedCard(row: RaidSignupView, mutable: boolean): Promise<string> {
  const roleSpecs = specsByRole(row);
  const selectedSpec = row.selectedSpec ?? "";
  const icon = selectedSpec && row.selectedClass ? await specIcon(row.selectedClass, selectedSpec, row.selectedClass) : "";
  return `<article class="raid-participant-card raid-participant-card-assigned" draggable="${mutable ? "true" : "false"}"${mutable ? ` tabindex="0" data-raid-participant-card` : ""}
    data-assigned="true"
    data-current-role="${htmlText(row.selectedRole ?? "")}" data-current-spec="${htmlText(selectedSpec)}"
    data-signup-row-id="${htmlText(row.signupRowId)}" data-role-specs="${htmlText(JSON.stringify(roleSpecs))}">
    <div class="raid-participant-assigned-icon">${icon}</div>
    <div class="raid-participant-card-copy"><strong>${htmlText(row.displayName)}</strong><span>${htmlText(selectedSpec)}${row.selectedClass ? ` ${htmlText(row.selectedClass)}` : ""}</span></div>
    ${mutable ? `<button type="button" class="raid-assignment-remove" data-raid-unassign aria-label="Return ${htmlText(row.displayName)} to available participants" title="Return to available">×</button>` : ""}
  </article>`;
}

async function raidBuffDiagnosticItem(trait: RaidBuffTrait, assigned: readonly RaidSignupView[]): Promise<string> {
  const label = raidBuffLabel(trait);
  const iconUrl = await raidBuffIconUrl(trait);
  const count = coverageCount(assigned, trait);
  const icon = iconUrl ? `<img class="raid-diagnostic-icon" src="${htmlText(iconUrl)}" alt="" aria-hidden="true">` : `<span class="raid-diagnostic-icon-placeholder" aria-hidden="true"></span>`;
  return `<li class="raid-diagnostic-item" data-count="${count}">${icon}<span class="raid-diagnostic-label">${htmlText(label)}</span><strong class="raid-diagnostic-count">${count}</strong></li>`;
}

function textDiagnosticItem(label: string, count: number): string {
  return `<li class="raid-diagnostic-item" data-count="${count}"><span class="raid-diagnostic-text-spacer" aria-hidden="true"></span><span class="raid-diagnostic-label">${htmlText(label)}</span><strong class="raid-diagnostic-count">${count}</strong></li>`;
}

function diagnosticPanel(id: string, label: string, body: string): string {
  return `<section class="raid-diagnostic-panel" id="${id}" data-raid-shelf-panel data-open="false" aria-label="${htmlText(label)}"><div class="raid-diagnostic-panel-header"><h3>${htmlText(label)}</h3><button type="button" class="raid-diagnostic-close" data-raid-shelf-close aria-label="Close ${htmlText(label)}">×</button></div><ul class="raid-diagnostic-list">${body}</ul></section>`;
}

function raidActionStatusCode(error: unknown): 400 | 403 {
  return error instanceof GuildCapabilityDeniedError ? 403 : 400;
}

async function renderRaidOrganizer(request: FastifyRequest<{ Params: RaidParams }>, reply: FastifyReply, assets: AssetRegistry) {
  const sessionToken = request.cookies[SESSION_COOKIE_NAME];
  const [viewer, identity] = await Promise.all([viewerForRequest(sessionToken), authenticatedIdentity(sessionToken)]);
  const [canModify, canStage, canAssign] = identity
    ? await Promise.all([
        identityHasGuildCapabilityOrOperator(identity.identityId, RAID_MODIFY_CAPABILITY),
        identityHasGuildCapabilityOrOperator(identity.identityId, RAID_STAGE_CAPABILITY),
        identityHasGuildCapabilityOrOperator(identity.identityId, RAID_ASSIGN_CAPABILITY),
      ])
    : [false, false, false];
  const authorized = canModify || canStage || canAssign;
  if (!identity || !authorized) {
    const html = renderPage(assets, {
      pathname: request.url,
      title: `Raid Operations · ${viewer.guildPresentation.guildName} Guild Operations`,
      viewer,
      stylesheets: ["admin.css", "raid-admin.css"],
      secondaryNavigation: { kind: "breadcrumb", items: [{ label: "Activities", href: "/activities" }, { label: "Raid operations", href: "/activities/raid/manage" }, { label: "Unavailable" }] },
      header: `<div class="admin-page-header"><h1>Raid</h1></div>`,
      body: `<section class="admin-unavailable"><h2>Raid operations are not available for this account.</h2></section>`,
    });
    return reply.code(identity ? 403 : 401).header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  }
  if (!canAssign && (canModify || canStage)) return reply.redirect(`/activities/raid/${encodeURIComponent(request.params.raidId)}/manage/definition`);

  const raid = await raidEventFacts(request.params.raidId);
  if (!raid) return reply.code(404).send({ error: "Raid not found" });
  const historical = raid.concludedAtUnix !== null;
  const destinations = raidOccurrenceDestinations(raid.raidId);
  const publicDestination = destinations.find((value) => value.kind === "public");
  const operateDestination = destinations.find((value) => value.kind === "operate");
  if (!operateDestination) throw new Error("Raid operate destination is not configured");

  const [rows, diagnostics, adjudications] = await Promise.all([raidSignups(raid.raidId), raidRosterDiagnostics(raid.raidId), raidCommitmentAdjudications(raid.raidId)]);
  const assigned = rows.filter((row) => row.assignmentId !== null);
  const available = rows.filter((row) => row.assignmentId === null && row.deniedAtUnix === null && !rows.some((candidate) => candidate.actorKind === row.actorKind && candidate.actorReference === row.actorReference && candidate.assignmentId !== null));
  const navigation: SecondaryNavigation = { kind: "breadcrumb", items: [{ label: "Activities", href: "/activities" }, { label: "Raid operations", href: "/activities/raid/manage" }, { label: raid.label }] };
  const raidBuffItems = (await Promise.all(RAID_BUFF_TRAITS.map((trait) => raidBuffDiagnosticItem(trait, assigned)))).join("");
  const utilityItems = UTILITY_TRAITS.map((trait) => textDiagnosticItem(capabilityLabel(trait), coverageCount(assigned, trait))).join("");
  const armorItems = ARMOR_TRAITS.map((trait) => textDiagnosticItem(armorLabel(trait), coverageCount(assigned, trait))).join("");
  const diagnosticsBody = `<dl class="raid-roster-diagnostics"><div class="raid-comp-tank"><dt><span class="raid-role-icon raid-role-icon-tank" aria-hidden="true"></span>Tank</dt><dd>${diagnostics.tanks}</dd></div><div class="raid-comp-healer"><dt><span class="raid-role-icon raid-role-icon-healer" aria-hidden="true"></span>Healer</dt><dd>${diagnostics.healers}</dd></div><div class="raid-comp-melee"><dt><span class="raid-role-icon raid-role-icon-damage" aria-hidden="true"></span>Melee</dt><dd>${diagnostics.melee}</dd></div><div class="raid-comp-ranged"><dt><span class="raid-role-icon raid-role-icon-damage" aria-hidden="true"></span>Ranged</dt><dd>${diagnostics.ranged}</dd></div></dl>`;
  const shelves = `<div class="raid-diagnostic-shelves" data-raid-diagnostics><div class="raid-diagnostic-tabs" aria-label="Raid diagnostics"><button type="button" class="raid-diagnostic-tab" data-raid-shelf-toggle aria-expanded="false" aria-controls="raid-buffs-panel">Raid buffs</button><button type="button" class="raid-diagnostic-tab" data-raid-shelf-toggle aria-expanded="false" aria-controls="raid-utility-panel">Utility</button><button type="button" class="raid-diagnostic-tab" data-raid-shelf-toggle aria-expanded="false" aria-controls="raid-armor-panel">Armor</button></div><div class="raid-diagnostic-panels">${diagnosticPanel("raid-buffs-panel", "Raid buffs", raidBuffItems)}${diagnosticPanel("raid-utility-panel", "Utility", utilityItems)}${diagnosticPanel("raid-armor-panel", "Armor", armorItems)}</div></div>`;
  const pool = available.length ? (await Promise.all(available.map(signupCard))).join("") : `<p class="raid-pool-empty">No unresolved signups remain.</p>`;
  const mutableAssignments = canAssign && !historical;
  const lanes = (await Promise.all(RAID_ROLES.map(async (role) => {
    const members = assigned.filter((row) => row.selectedRole === role);
    const cards = (await Promise.all(members.map((row) => assignedCard(row, mutableAssignments)))).join("");
    return `<section class="raid-role-lane"${mutableAssignments ? ` data-raid-role-drop="${role}"` : ""}><div class="raid-role-lane-heading"><h3>${htmlText(roleLabel(role))}</h3><span>${members.length}</span></div><div class="raid-role-cards">${cards}</div>${mutableAssignments ? `<button type="button" class="raid-add-slot" data-raid-drop-role="${role}" aria-label="Assign a ${htmlText(roleLabel(role).toLowerCase())}">+</button>` : ""}</section>`;
  }))).join("");
  const assignmentWorkspace = mutableAssignments
    ? `<section class="raid-workspace"><p class="raid-board-status" data-raid-action-status role="status" aria-live="polite"></p>${diagnosticsBody}<div class="raid-organizer-grid"><section class="raid-pool-panel" data-raid-pool-panel data-open="false" id="raid-applicant-pool-panel"><div class="raid-pool-panel-header"><h2>Available</h2><span>${available.length}</span><button type="button" class="raid-pool-close" data-raid-pool-close aria-label="Close available participants">×</button></div><div class="raid-signup-pool" data-raid-pool-drop>${pool}</div></section><div class="raid-assignment-board"><h2>Raid group</h2><div class="raid-role-lanes">${lanes}</div></div></div><button type="button" class="raid-pool-toggle" data-raid-pool-toggle data-raid-pool-drop aria-expanded="false" aria-controls="raid-applicant-pool-panel"><span>Available</span><span>${available.length}</span></button></section>`
    : `<section class="raid-workspace">${historical ? `<p class="raid-board-status">This raid is concluded. Its final assignment is preserved as history.</p>` : ""}${diagnosticsBody}<div class="raid-assignment-board"><h2>Raid group</h2><div class="raid-role-lanes">${lanes}</div></div></section>`;

  const basePath = operateDestination.href;
  const adjudicationBySignup=new Map(adjudications.map(value=>[value.signupRowId,value.fulfilled]));
  const commitments=rows.filter(row=>row.withdrawnAtUnix===null&&row.deniedAtUnix===null);
  const closeout=!historical&&canStage?`<section class="raid-workspace"><h2>Close out raid</h2><p>Declare whether each commitment obligation was fulfilled, then conclude the raid.</p><div class="raid-signup-pool">${commitments.map(row=>{const value=adjudicationBySignup.get(row.signupRowId);return `<article class="raid-participant-card"><div class="raid-participant-card-copy"><strong>${htmlText(row.displayName)}</strong><span>${row.offeredSpecs.map((spec)=>htmlText(`${spec.specName} ${spec.className}`)).join(", ")}</span></div><div><button type="button" class="button-secondary" data-raid-adjudicate="${htmlText(row.signupRowId)}" data-fulfilled="true"${value===true?" disabled":""}>Fulfilled</button> <button type="button" class="button-secondary" data-raid-adjudicate="${htmlText(row.signupRowId)}" data-fulfilled="false"${value===false?" disabled":""}>Not fulfilled</button></div></article>`;}).join("")}</div><p class="raid-board-status" data-raid-closeout-status role="status" aria-live="polite"></p><button type="button" class="button-primary" data-raid-conclude${commitments.some(row=>!adjudicationBySignup.has(row.signupRowId))?" disabled":""}>Conclude raid</button></section>`:"";
  const workspace = `${assignmentWorkspace}${closeout}<section class="raid-scoreboard" aria-labelledby="raid-scoreboard-heading"><h2 id="raid-scoreboard-heading">Raid diagnostics</h2>${shelves}</section>${mutableAssignments ? `<dialog class="raid-spec-dialog" data-raid-spec-dialog><form method="dialog"><h2>Choose specialization</h2><p data-raid-spec-dialog-copy></p><div data-raid-spec-options></div><button type="button" class="button-secondary" data-raid-spec-cancel>Cancel</button></form></dialog>` : ""}`;
  const lifecycleActions = canStage && !historical ? `<button type="button" class="button-destructive" data-raid-cancel>Cancel raid</button>` : "";
  const body = renderOccurrenceOperations({ title: raid.label, context: `<time data-unix-time="${raid.occursAt[0]}">${raid.occursAt[0]}</time> · ${htmlText(difficultyLabel(raid.difficulty))}${historical ? " · Historical" : ""}`, publicAction: publicDestination ? { label: publicDestination.label, href: publicDestination.href } : undefined, modes: [{ label: "Assign", href: basePath, current: true }, ...(canModify || canStage ? [{ label: "Edit", href: `${basePath}/definition` }] : [])], lifecycleActions, workspace });
  const scripts: AssetName[] = ["admin.js", "raid-admin.js", ...(lifecycleActions ? ["raid-definition.js" as AssetName] : [])];
  if (mutableAssignments || (!historical && canStage)) scripts.push("raid-organizer.js");
  const html = renderPage(assets, { pathname: request.url, title: `${raid.label} · Raid Operations · ${viewer.guildPresentation.guildName} Guild Operations`, description: raid.description ?? "Raid operations.", viewer, stylesheets: ["admin.css", "raid-admin.css", "raid-iconography.css", "raid-organizer.css"], scripts, secondaryNavigation: navigation, header: "", body });
  return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
}

async function assignParticipant(request: FastifyRequest<{ Params: RaidParams; Body: AssignBody }>, reply: FastifyReply) {
  const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
  if (!identity) return reply.code(401).send({ error: "Authentication required" });
  const body = request.body ?? {};
  if (typeof body.signupRowId !== "string" || typeof body.selectedClass !== "string" || typeof body.selectedSpec !== "string" || (body.selectedRole !== "tank" && body.selectedRole !== "healer" && body.selectedRole !== "damage")) return reply.code(400).send({ error: "Assignment is incomplete" });
  try {
    const assignment = await setRaidAssignment(identity.identityId, { raidId: request.params.raidId, signupRowId: body.signupRowId, selectedClass: body.selectedClass, selectedSpec: body.selectedSpec, selectedRole: body.selectedRole });
    return reply.code(assignment.established ? 201 : 200).send({ assignmentId: assignment.assignmentId });
  } catch (error) {
    return reply.code(raidActionStatusCode(error)).send({ error: error instanceof Error ? error.message : "Participant could not be assigned" });
  }
}

async function unassignParticipant(request: FastifyRequest<{ Params: RaidParams; Body: UnassignBody }>, reply: FastifyReply) {
  const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
  if (!identity) return reply.code(401).send({ error: "Authentication required" });
  if (typeof request.body?.signupRowId !== "string") return reply.code(400).send({ error: "Participation row is required" });
  try {
    await withdrawRaidAssignment(identity.identityId, request.params.raidId, request.body.signupRowId);
    return { ok: true };
  } catch (error) {
    return reply.code(raidActionStatusCode(error)).send({ error: error instanceof Error ? error.message : "Participant could not be unassigned" });
  }
}

async function adjudicateCommitment(request:FastifyRequest<{Params:RaidParams;Body:AdjudicateBody}>,reply:FastifyReply){
  const identity=await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);if(!identity)return reply.code(401).send({error:"Authentication required"});
  if(typeof request.body?.signupRowId!=="string"||typeof request.body?.fulfilled!=="boolean")return reply.code(400).send({error:"Commitment adjudication is incomplete"});
  try{await adjudicateRaidCommitment(identity.identityId,request.params.raidId,request.body.signupRowId,request.body.fulfilled);return{ok:true};}catch(error){return reply.code(raidActionStatusCode(error)).send({error:error instanceof Error?error.message:"Commitment could not be adjudicated"});}
}
async function concludeRaidOperation(request:FastifyRequest<{Params:RaidParams}>,reply:FastifyReply){
  const identity=await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);if(!identity)return reply.code(401).send({error:"Authentication required"});
  try{await concludeRaid(identity.identityId,request.params.raidId);return{ok:true};}catch(error){return reply.code(raidActionStatusCode(error)).send({error:error instanceof Error?error.message:"Raid could not be concluded"});}
}

export async function registerRaidOperationDetailPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get<{ Params: RaidParams }>("/activities/raid/:raidId/manage", async (request, reply) => renderRaidOrganizer(request, reply, assets));
  app.post<{ Params: RaidParams; Body: AssignBody }>("/activities/raid/:raidId/manage/assign", assignParticipant);
  app.post<{ Params: RaidParams; Body: UnassignBody }>("/activities/raid/:raidId/manage/unassign", unassignParticipant);
  app.post<{ Params: RaidParams; Body: AdjudicateBody }>("/activities/raid/:raidId/manage/adjudicate", adjudicateCommitment);
  app.post<{ Params: RaidParams }>("/activities/raid/:raidId/manage/conclude", concludeRaidOperation);
}
