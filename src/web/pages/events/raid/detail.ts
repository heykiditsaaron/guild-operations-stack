import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../../../auth.js";
import { GuildCapabilityDeniedError, RAID_MANAGE_CAPABILITY, guildieHasGuildCapabilityOrOperator } from "../../../../guild-permissions.js";
import {
  assignRaidParticipation,
  raidEventFacts,
  raidRosterDiagnostics,
  setRaidSignupsOpen,
  unassignRaidParticipation,
} from "../../../../modules/raid/application.js";
import { raidSignupRows } from "../../../../modules/raid/participation-view.js";
import type { RaidDifficulty, RaidRole } from "../../../../modules/raid/domain.js";
import {
  isRaidBuffTrait,
  raidBuffIconUrl,
  raidBuffLabel,
  specializationIconUrl,
  type RaidBuffTrait,
} from "../../../../wow-iconography.js";
import { allWowTraits, specHasTrait, traitsForSpec, type WowTrait } from "../../../../wow-traits/registry.js";
import type { AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage, type SecondaryNavigation } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

type RaidParams = { raidId: string };
type ToggleBody = { open?: unknown };
type AssignBody = { signupRowId?: unknown; selectedSpec?: unknown; selectedRole?: unknown };
type UnassignBody = { signupRowId?: unknown };
type RaidSignupRowView = Awaited<ReturnType<typeof raidSignupRows>>[number];

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

function specsByRole(className: string, willingSpecs: readonly string[], willingRoles: readonly RaidRole[]): Record<RaidRole, string[]> {
  return {
    tank: willingRoles.includes("tank") ? willingSpecs.filter((spec) => specHasTrait(className, spec, ROLE_TRAITS.tank)) : [],
    healer: willingRoles.includes("healer") ? willingSpecs.filter((spec) => specHasTrait(className, spec, ROLE_TRAITS.healer)) : [],
    damage: willingRoles.includes("damage") ? willingSpecs.filter((spec) => specHasTrait(className, spec, ROLE_TRAITS.damage)) : [],
  };
}

function coverageCount(rows: readonly RaidSignupRowView[], trait: WowTrait): number {
  return rows.reduce((count, row) => {
    if (!row.selectedSpec) return count;
    return traitsForSpec(row.className, row.selectedSpec).includes(trait) ? count + 1 : count;
  }, 0);
}

async function specIcon(className: string, specName: string, classNameValue: string): Promise<string> {
  const iconUrl = await specializationIconUrl(className, specName);
  if (!iconUrl) return `<span class="raid-spec-icon-fallback">${htmlText(specName)}</span>`;
  return `<img class="raid-spec-icon" src="${htmlText(iconUrl)}" alt="" aria-hidden="true" title="${htmlText(`${specName} ${classNameValue}`)}">`;
}

function offeredRoleIcons(row: RaidSignupRowView): string {
  const roleSpecs = specsByRole(row.className, row.willingSpecs, row.willingRoles);
  const roles = RAID_ROLES.filter((role) => roleSpecs[role].length > 0);
  if (!roles.length) return "";
  return `<div class="raid-participant-roles" aria-label="Offered roles">${roles.map((role) => `<span class="raid-role-icon raid-role-icon-${role}" role="img" aria-label="${htmlText(roleLabel(role))}" title="${htmlText(roleLabel(role))}"></span>`).join("")}</div>`;
}

async function signupCard(row: RaidSignupRowView): Promise<string> {
  const roleSpecs = specsByRole(row.className, row.willingSpecs, row.willingRoles);
  return `<article class="raid-participant-card" draggable="true" tabindex="0"
    data-raid-participant-card
    data-assigned="false"
    data-signup-row-id="${htmlText(row.signupRowId)}"
    data-role-specs="${htmlText(JSON.stringify(roleSpecs))}">
    <div class="raid-participant-card-copy">
      <strong>${htmlText(row.characterName ?? row.className)}</strong>
      <span>${row.realmName ? `${htmlText(row.realmName)} · ` : ""}${htmlText(row.className)}</span>
    </div>
    ${offeredRoleIcons(row)}
  </article>`;
}

async function assignedCard(row: RaidSignupRowView): Promise<string> {
  const roleSpecs = specsByRole(row.className, row.willingSpecs, row.willingRoles);
  const selectedSpec = row.selectedSpec ?? "";
  const icon = selectedSpec ? await specIcon(row.className, selectedSpec, row.className) : "";
  return `<article class="raid-participant-card raid-participant-card-assigned" draggable="true" tabindex="0"
    data-raid-participant-card
    data-assigned="true"
    data-current-role="${htmlText(row.selectedRole ?? "")}"
    data-current-spec="${htmlText(selectedSpec)}"
    data-signup-row-id="${htmlText(row.signupRowId)}"
    data-role-specs="${htmlText(JSON.stringify(roleSpecs))}">
    <div class="raid-participant-assigned-icon">${icon}</div>
    <div class="raid-participant-card-copy">
      <strong>${htmlText(row.characterName ?? row.className)}</strong>
      <span>${htmlText(selectedSpec)}</span>
    </div>
    <button type="button" class="raid-assignment-remove" data-raid-unassign aria-label="Return ${htmlText(row.characterName ?? row.className)} to available participants" title="Return to available">×</button>
  </article>`;
}

async function raidBuffDiagnosticItem(trait: RaidBuffTrait, assigned: readonly RaidSignupRowView[]): Promise<string> {
  const label = raidBuffLabel(trait);
  const iconUrl = await raidBuffIconUrl(trait);
  const count = coverageCount(assigned, trait);
  const icon = iconUrl
    ? `<img class="raid-diagnostic-icon" src="${htmlText(iconUrl)}" alt="" aria-hidden="true">`
    : `<span class="raid-diagnostic-icon-placeholder" aria-hidden="true"></span>`;
  return `<li class="raid-diagnostic-item" data-count="${count}">${icon}<span class="raid-diagnostic-label">${htmlText(label)}</span><strong class="raid-diagnostic-count">${count}</strong></li>`;
}

function textDiagnosticItem(label: string, count: number): string {
  return `<li class="raid-diagnostic-item" data-count="${count}"><span class="raid-diagnostic-text-spacer" aria-hidden="true"></span><span class="raid-diagnostic-label">${htmlText(label)}</span><strong class="raid-diagnostic-count">${count}</strong></li>`;
}

function diagnosticPanel(id: string, label: string, body: string): string {
  return `<section class="raid-diagnostic-panel" id="${id}" data-raid-shelf-panel data-open="false" aria-label="${htmlText(label)}">
    <div class="raid-diagnostic-panel-header"><h3>${htmlText(label)}</h3><button type="button" class="raid-diagnostic-close" data-raid-shelf-close aria-label="Close ${htmlText(label)}">×</button></div>
    <ul class="raid-diagnostic-list">${body}</ul>
  </section>`;
}

function raidActionStatusCode(error: unknown): 400 | 403 {
  return error instanceof GuildCapabilityDeniedError ? 403 : 400;
}

export async function registerRaidAdminDetailPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get<{ Params: RaidParams }>("/admin/raid/:raidId", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([viewerForRequest(sessionToken), authenticatedGuildie(sessionToken)]);
    const authorized = guildie ? await guildieHasGuildCapabilityOrOperator(guildie.guildieId, RAID_MANAGE_CAPABILITY) : false;
    if (!guildie || !authorized) {
      const html = renderPage(assets, {
        pathname: request.url,
        title: "Raid Administration · OH CRIT I Pulled! Guild Operations",
        viewer,
        stylesheets: ["admin.css", "raid-admin.css"],
        secondaryNavigation: { kind: "breadcrumb", items: [{ label: "Administration", href: "/admin" }, { label: "Raid", href: "/admin/raid" }, { label: "Unavailable" }] },
        header: `<div class="admin-page-header"><h1>Raid</h1></div>`,
        body: `<section class="admin-unavailable"><h2>Raid management is not available for this account.</h2></section>`,
      });
      return reply.code(guildie ? 403 : 401).header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
    }

    const raid = await raidEventFacts(request.params.raidId);
    if (!raid) return reply.code(404).send({ error: "Raid not found" });

    const [rows, diagnostics] = await Promise.all([
      raidSignupRows(raid.raidId),
      raidRosterDiagnostics(raid.raidId),
    ]);
    const assigned = rows.filter((row) => row.assignmentId !== null);
    const available = rows.filter((row) => row.assignmentId === null && !rows.some((candidate) => candidate.applicantId === row.applicantId && candidate.assignmentId !== null));
    const applicantCount = new Set(rows.map((row) => row.applicantId)).size;

    const navigation: SecondaryNavigation = {
      kind: "breadcrumb",
      items: [{ label: "Administration", href: "/admin" }, { label: "Raid", href: "/admin/raid" }, { label: raid.label }],
    };

    const raidBuffItems = (await Promise.all(RAID_BUFF_TRAITS.map((trait) => raidBuffDiagnosticItem(trait, assigned)))).join("");
    const utilityItems = UTILITY_TRAITS.map((trait) => textDiagnosticItem(capabilityLabel(trait), coverageCount(assigned, trait))).join("");
    const armorItems = ARMOR_TRAITS.map((trait) => textDiagnosticItem(armorLabel(trait), coverageCount(assigned, trait))).join("");

    const diagnosticsBody = `<dl class="raid-roster-diagnostics">
      <div><dt>Assigned</dt><dd>${diagnostics.assigned}<span>/${applicantCount}</span></dd></div>
      <div><dt>Tanks</dt><dd>${diagnostics.tanks}</dd></div>
      <div><dt>Healers</dt><dd>${diagnostics.healers}</dd></div>
      <div><dt>Damage</dt><dd>${diagnostics.damage}</dd></div>
      <div><dt>Melee</dt><dd>${diagnostics.melee}</dd></div>
      <div><dt>Ranged</dt><dd>${diagnostics.ranged}</dd></div>
    </dl>`;

    const shelves = `<div class="raid-diagnostic-shelves" data-raid-diagnostics>
      <div class="raid-diagnostic-tabs" aria-label="Raid diagnostics">
        <button type="button" class="raid-diagnostic-tab" data-raid-shelf-toggle aria-expanded="false" aria-controls="raid-buffs-panel">Raid buffs</button>
        <button type="button" class="raid-diagnostic-tab" data-raid-shelf-toggle aria-expanded="false" aria-controls="raid-utility-panel">Utility</button>
        <button type="button" class="raid-diagnostic-tab" data-raid-shelf-toggle aria-expanded="false" aria-controls="raid-armor-panel">Armor</button>
      </div>
      <div class="raid-diagnostic-panels">
        ${diagnosticPanel("raid-buffs-panel", "Raid buffs", raidBuffItems)}
        ${diagnosticPanel("raid-utility-panel", "Utility", utilityItems)}
        ${diagnosticPanel("raid-armor-panel", "Armor", armorItems)}
      </div>
    </div>`;

    const pool = available.length
      ? (await Promise.all(available.map(signupCard))).join("")
      : `<p class="raid-pool-empty">All applicants are currently assigned.</p>`;

    const lanes = (await Promise.all(RAID_ROLES.map(async (role) => {
      const members = assigned.filter((row) => row.selectedRole === role);
      const cards = (await Promise.all(members.map(assignedCard))).join("");
      return `<section class="raid-role-lane" data-raid-role-drop="${role}">
        <div class="raid-role-lane-heading"><h3>${htmlText(roleLabel(role))}</h3><span>${members.length}</span></div>
        <div class="raid-role-cards">${cards}</div>
        <button type="button" class="raid-add-slot" data-raid-drop-role="${role}" aria-label="Assign a ${htmlText(roleLabel(role).toLowerCase())}">+</button>
      </section>`;
    }))).join("");

    const body = `<section class="raid-title-bar">
        <div>
          <h1>${htmlText(raid.label)}</h1>
          <p><time data-unix-time="${raid.occursAt[0]}">${raid.occursAt[0]}</time> · ${htmlText(difficultyLabel(raid.difficulty))} · Signups ${raid.signupsOpen ? "open" : "closed"}</p>
        </div>
        <div class="raid-admin-actions">
          <button type="button" class="button-secondary" disabled title="Raid metadata editing will be added later">Edit</button>
          <button type="button" class="button-primary" data-raid-signups-toggle data-open="${raid.signupsOpen ? "false" : "true"}">${raid.signupsOpen ? "Close signups" : "Open signups"}</button>
          <a class="button-secondary" href="/events/raid/${encodeURIComponent(raid.raidId)}">View signup page ↗</a>
        </div>
      </section>
      <section class="raid-workspace">
        <p class="raid-board-status" data-raid-action-status role="status" aria-live="polite"></p>
        ${diagnosticsBody}
        <div class="raid-organizer-grid">
          <section class="raid-pool-panel" data-raid-pool-panel data-open="false" id="raid-applicant-pool-panel">
            <div class="raid-pool-panel-header"><h2>Available</h2><span>${available.length}</span><button type="button" class="raid-pool-close" data-raid-pool-close aria-label="Close available participants">×</button></div>
            <div class="raid-signup-pool" data-raid-pool-drop>${pool}</div>
          </section>
          <div class="raid-assignment-board">
            <h2>Raid group</h2>
            <div class="raid-role-lanes">${lanes}</div>
          </div>
        </div>
        <button type="button" class="raid-pool-toggle" data-raid-pool-toggle data-raid-pool-drop aria-expanded="false" aria-controls="raid-applicant-pool-panel"><span>Available</span><span>${available.length}</span></button>
      </section>
      <section class="raid-scoreboard" aria-labelledby="raid-scoreboard-heading">
        <h2 id="raid-scoreboard-heading">Raid diagnostics</h2>
        ${shelves}
      </section>
      <dialog class="raid-spec-dialog" data-raid-spec-dialog>
        <form method="dialog">
          <h2>Choose specialization</h2>
          <p data-raid-spec-dialog-copy></p>
          <div data-raid-spec-options></div>
          <button type="button" class="button-secondary" data-raid-spec-cancel>Cancel</button>
        </form>
      </dialog>`;

    const html = renderPage(assets, {
      pathname: request.url,
      title: `${raid.label} · Raid Administration · OH CRIT I Pulled! Guild Operations`,
      description: raid.description ?? "Raid administration.",
      viewer,
      stylesheets: ["admin.css", "raid-admin.css", "raid-iconography.css", "raid-organizer.css"],
      scripts: ["admin.js", "raid-admin.js", "raid-organizer.js"],
      secondaryNavigation: navigation,
      header: "",
      body,
    });
    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  });

  app.post<{ Params: RaidParams; Body: ToggleBody }>("/admin/raid/:raidId/signups", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "Authentication required" });
    if (typeof request.body?.open !== "boolean") return reply.code(400).send({ error: "Signup state is required" });
    try {
      await setRaidSignupsOpen(guildie.guildieId, request.params.raidId, request.body.open);
      return { ok: true };
    } catch (error) {
      return reply.code(raidActionStatusCode(error)).send({ error: error instanceof Error ? error.message : "Signup state could not be changed" });
    }
  });

  app.post<{ Params: RaidParams; Body: AssignBody }>("/admin/raid/:raidId/assign", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "Authentication required" });
    const body = request.body ?? {};
    if (typeof body.signupRowId !== "string" || typeof body.selectedSpec !== "string" || (body.selectedRole !== "tank" && body.selectedRole !== "healer" && body.selectedRole !== "damage")) {
      return reply.code(400).send({ error: "Assignment is incomplete" });
    }
    try {
      const assignmentId = await assignRaidParticipation(guildie.guildieId, {
        raidId: request.params.raidId,
        signupRowId: body.signupRowId,
        selectedSpec: body.selectedSpec,
        selectedRole: body.selectedRole,
      });
      return reply.code(201).send({ assignmentId });
    } catch (error) {
      return reply.code(raidActionStatusCode(error)).send({ error: error instanceof Error ? error.message : "Participant could not be assigned" });
    }
  });

  app.post<{ Params: RaidParams; Body: UnassignBody }>("/admin/raid/:raidId/unassign", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "Authentication required" });
    if (typeof request.body?.signupRowId !== "string") return reply.code(400).send({ error: "Participation row is required" });
    try {
      await unassignRaidParticipation(guildie.guildieId, request.params.raidId, request.body.signupRowId);
      return { ok: true };
    } catch (error) {
      return reply.code(raidActionStatusCode(error)).send({ error: error instanceof Error ? error.message : "Participant could not be unassigned" });
    }
  });
}
