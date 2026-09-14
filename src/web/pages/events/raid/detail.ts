import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../../../auth.js";
import { RAID_CREATE_CAPABILITY, guildieHasGuildCapability } from "../../../../guild-permissions.js";
import {
  assignRaidParticipation,
  assignedRaidCapabilities,
  raidEventFacts,
  raidRosterDiagnostics,
  setRaidSignupsOpen,
  unassignRaidParticipation,
} from "../../../../modules/raid/application.js";
import { raidSignupRows } from "../../../../modules/raid/participation-view.js";
import type { RaidDifficulty, RaidRole } from "../../../../modules/raid/domain.js";
import { specHasTrait, type WowTrait } from "../../../../wow-traits/registry.js";
import type { AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage, type SecondaryNavigation } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

type RaidParams = { raidId: string };
type ToggleBody = { open?: unknown };
type AssignBody = { signupRowId?: unknown; selectedSpec?: unknown; selectedRole?: unknown };
type UnassignBody = { signupRowId?: unknown };

const RAID_ROLES: readonly RaidRole[] = ["tank", "healer", "damage"];
const ROLE_TRAITS: Record<RaidRole, WowTrait> = {
  tank: "role.tank",
  healer: "role.healer",
  damage: "role.damage",
};

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

function specsByRole(className: string, willingSpecs: readonly string[], willingRoles: readonly RaidRole[]): Record<RaidRole, string[]> {
  return {
    tank: willingRoles.includes("tank") ? willingSpecs.filter((spec) => specHasTrait(className, spec, ROLE_TRAITS.tank)) : [],
    healer: willingRoles.includes("healer") ? willingSpecs.filter((spec) => specHasTrait(className, spec, ROLE_TRAITS.healer)) : [],
    damage: willingRoles.includes("damage") ? willingSpecs.filter((spec) => specHasTrait(className, spec, ROLE_TRAITS.damage)) : [],
  };
}

function signupCard(row: Awaited<ReturnType<typeof raidSignupRows>>[number]): string {
  const roleSpecs = specsByRole(row.className, row.willingSpecs, row.willingRoles);
  return `<article class="raid-participant-card" draggable="true" tabindex="0"
    data-raid-participant-card
    data-signup-row-id="${htmlText(row.signupRowId)}"
    data-role-specs="${htmlText(JSON.stringify(roleSpecs))}">
    <strong>${htmlText(row.characterName ?? row.className)}</strong>
    <span>${row.realmName ? `${htmlText(row.realmName)} · ` : ""}${htmlText(row.className)}</span>
    <small>${row.willingRoles.map((role) => htmlText(roleLabel(role))).join(" · ")}</small>
  </article>`;
}

function assignedCard(row: Awaited<ReturnType<typeof raidSignupRows>>[number]): string {
  return `<article class="raid-participant-card raid-participant-card-assigned" draggable="true" tabindex="0"
    data-raid-assigned-card
    data-signup-row-id="${htmlText(row.signupRowId)}">
    <strong>${htmlText(row.characterName ?? row.className)}</strong>
    <span>${htmlText(row.selectedSpec ?? "")} · ${htmlText(roleLabel(row.selectedRole!))}</span>
    <button type="button" class="raid-card-remove" data-raid-unassign data-signup-row-id="${htmlText(row.signupRowId)}" aria-label="Unassign ${htmlText(row.characterName ?? row.className)}">×</button>
  </article>`;
}

export async function registerRaidAdminDetailPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get<{ Params: RaidParams }>("/admin/raid/:raidId", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([viewerForRequest(sessionToken), authenticatedGuildie(sessionToken)]);
    const authorized = guildie ? await guildieHasGuildCapability(guildie.guildieId, RAID_CREATE_CAPABILITY) : false;
    if (!guildie || !authorized) {
      const html = renderPage(assets, {
        pathname: request.url,
        title: "Raid Administration · OH CRIT I Pulled! Guild Operations",
        viewer,
        stylesheets: ["admin.css", "raid-admin.css"],
        secondaryNavigation: { kind: "breadcrumb", items: [{ label: "Administration", href: "/admin" }, { label: "Raid", href: "/admin/raid" }, { label: "Unavailable" }] },
        header: `<div class="admin-page-header"><h1>Raid</h1></div>`,
        body: `<section class="admin-unavailable"><h2>Raid administration is not available for this account.</h2></section>`,
      });
      return reply.code(guildie ? 403 : 401).header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
    }

    const raid = await raidEventFacts(request.params.raidId);
    if (!raid) return reply.code(404).send({ error: "Raid not found" });

    const [rows, capabilities, diagnostics] = await Promise.all([
      raidSignupRows(raid.raidId),
      assignedRaidCapabilities(raid.raidId),
      raidRosterDiagnostics(raid.raidId),
    ]);
    const assigned = rows.filter((row) => row.assignmentId !== null);
    const available = rows.filter((row) => row.assignmentId === null && !rows.some((candidate) => candidate.applicantId === row.applicantId && candidate.assignmentId !== null));

    const navigation: SecondaryNavigation = {
      kind: "breadcrumb",
      items: [{ label: "Administration", href: "/admin" }, { label: "Raid", href: "/admin/raid" }, { label: raid.label }],
    };

    const capabilityBody = capabilities.length
      ? `<ul class="raid-capabilities">${capabilities.map((capability) => `<li>${htmlText(capabilityLabel(capability))}</li>`).join("")}</ul>`
      : `<p class="raid-scoreboard-empty">No capabilities are currently available from assigned participants.</p>`;

    const diagnosticsBody = `<dl class="raid-roster-diagnostics">
      <div><dt>Assigned</dt><dd>${diagnostics.assigned}</dd></div>
      <div><dt>Tanks</dt><dd>${diagnostics.tanks}</dd></div>
      <div><dt>Healers</dt><dd>${diagnostics.healers}</dd></div>
      <div><dt>Damage</dt><dd>${diagnostics.damage}</dd></div>
    </dl>`;

    const pool = available.length
      ? available.map(signupCard).join("")
      : `<p class="raid-pool-empty">No unassigned participation rows are available.</p>`;

    const lanes = RAID_ROLES.map((role) => {
      const members = assigned.filter((row) => row.selectedRole === role);
      return `<section class="raid-role-lane" data-raid-role-lane="${role}">
        <div class="raid-role-lane-heading"><h3>${htmlText(roleLabel(role))}</h3><span>${members.length}</span></div>
        <div class="raid-role-cards">${members.map(assignedCard).join("")}</div>
        <button type="button" class="raid-add-slot" data-raid-drop-role="${role}" aria-label="Assign a ${htmlText(roleLabel(role).toLowerCase())}">+</button>
      </section>`;
    }).join("");

    const body = `<section class="raid-title-bar">
        <div>
          <h1>${htmlText(raid.label)}</h1>
          <p><time data-unix-time="${raid.occursAt[0]}">${raid.occursAt[0]}</time> · ${htmlText(difficultyLabel(raid.difficulty))} · Signups ${raid.signupsOpen ? "open" : "closed"}</p>
        </div>
        <button type="button" class="button-secondary" disabled title="Raid metadata editing will be added later">Edit</button>
      </section>
      <section class="raid-scoreboard" aria-labelledby="raid-scoreboard-heading">
        <h2 id="raid-scoreboard-heading">Scoreboard</h2>
        ${diagnosticsBody}
        <div class="raid-scoreboard-capabilities"><h3>Available capabilities</h3>${capabilityBody}</div>
      </section>
      <section class="raid-workspace">
        <div class="raid-workspace-heading">
          <div><h2>Participation pool</h2><p>Drag a signup onto a role, or select a card and then choose a + slot.</p></div>
          <div class="raid-admin-actions">
            <button type="button" class="button-primary" data-raid-signups-toggle data-open="${raid.signupsOpen ? "false" : "true"}">${raid.signupsOpen ? "Close signups" : "Open signups"}</button>
            <a class="button-secondary" href="/events/raid/${encodeURIComponent(raid.raidId)}">View signup page ↗</a>
          </div>
        </div>
        <div class="raid-signup-pool" data-raid-pool-drop>${pool}</div>
        <p class="raid-board-status" data-raid-action-status role="status" aria-live="polite"></p>
        <div class="raid-assignment-board">
          <h2>Raid group</h2>
          <div class="raid-role-lanes">${lanes}</div>
        </div>
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
      stylesheets: ["admin.css", "raid-admin.css"],
      scripts: ["admin.js", "raid-admin.js"],
      secondaryNavigation: navigation,
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
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Signup state could not be changed" });
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
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Participant could not be assigned" });
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
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Participant could not be unassigned" });
    }
  });
}
