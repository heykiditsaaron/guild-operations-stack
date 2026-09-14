import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../../../auth.js";
import { RAID_CREATE_CAPABILITY, guildieHasGuildCapability } from "../../../../guild-permissions.js";
import {
  assignRaidParticipation,
  assignedRaidCapabilities,
  raidEventFacts,
  setRaidSignupsOpen,
  unassignRaidSlot,
} from "../../../../modules/raid/application.js";
import { raidSignupRows } from "../../../../modules/raid/participation-view.js";
import type { RaidRole } from "../../../../modules/raid/domain.js";
import type { AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage, type SecondaryNavigation } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

type RaidParams = { raidId: string };
type ToggleBody = { open?: unknown };
type AssignBody = { signupRowId?: unknown; slotIndex?: unknown; selectedSpec?: unknown; selectedRole?: unknown };
type UnassignBody = { slotIndex?: unknown };

function roleLabel(role: RaidRole): string {
  return role === "damage" ? "Damage" : role === "healer" ? "Healer" : "Tank";
}

function capabilityLabel(value: string): string {
  return value
    .replaceAll(".", " · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function option(value: string, label = value): string {
  return `<option value="${htmlText(value)}">${htmlText(label)}</option>`;
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

    const [rows, capabilities] = await Promise.all([
      raidSignupRows(raid.raidId),
      assignedRaidCapabilities(raid.raidId),
    ]);
    const assigned = rows.filter((row) => row.assignedSlotIndex !== null).sort((a, b) => (a.assignedSlotIndex ?? 0) - (b.assignedSlotIndex ?? 0));
    const available = rows.filter((row) => row.assignedSlotIndex === null && !rows.some((candidate) => candidate.applicantId === row.applicantId && candidate.assignedSlotIndex !== null));

    const navigation: SecondaryNavigation = {
      kind: "breadcrumb",
      items: [{ label: "Administration", href: "/admin" }, { label: "Raid", href: "/admin/raid" }, { label: raid.label }],
    };

    const roster = assigned.length
      ? `<ol class="raid-roster">${assigned.map((row) => `<li><strong>Slot ${row.assignedSlotIndex}</strong><span>${htmlText(row.characterName ?? row.className)} · ${htmlText(row.selectedSpec ?? "")} ${htmlText(roleLabel(row.selectedRole!))}</span><button type="button" data-raid-unassign data-slot-index="${row.assignedSlotIndex}">Unassign</button></li>`).join("")}</ol>`
      : `<p>No participants have been assigned yet.</p>`;

    const pool = available.length
      ? `<div class="raid-signup-pool">${available.map((row) => `<article class="raid-signup-row">
          <div><h3>${htmlText(row.characterName ?? row.className)}</h3><p>${row.realmName ? `${htmlText(row.realmName)} · ` : ""}${htmlText(row.className)}</p><p>Willing specs: ${row.willingSpecs.map(htmlText).join(", ")}</p><p>Willing roles: ${row.willingRoles.map((role) => htmlText(roleLabel(role))).join(", ")}</p></div>
          <form data-raid-assign data-signup-row-id="${htmlText(row.signupRowId)}">
            <label><span>Slot</span><input name="slotIndex" type="number" min="1" max="${raid.raidSize}" required></label>
            <label><span>Spec</span><select name="selectedSpec" required>${row.willingSpecs.map((spec) => option(spec)).join("")}</select></label>
            <label><span>Role</span><select name="selectedRole" required>${row.willingRoles.map((role) => option(role, roleLabel(role))).join("")}</select></label>
            <button type="submit" class="button-primary">Assign</button>
            <p data-raid-action-status role="status" aria-live="polite"></p>
          </form>
        </article>`).join("")}</div>`
      : `<p>No unassigned participation rows are available.</p>`;

    const capabilityBody = capabilities.length
      ? `<ul class="raid-capabilities">${capabilities.map((capability) => `<li>${htmlText(capabilityLabel(capability))}</li>`).join("")}</ul>`
      : `<p>No capabilities are currently available from assigned participants.</p>`;

    const body = `<section class="admin-section raid-admin-summary">
        <div class="raid-admin-actions">
          <button type="button" class="button-primary" data-raid-signups-toggle data-open="${raid.signupsOpen ? "false" : "true"}">${raid.signupsOpen ? "Close signups" : "Open signups"}</button>
          <a class="button-secondary" href="/events/raid/${encodeURIComponent(raid.raidId)}">View signup page ↗</a>
        </div>
        <dl><dt>Starts</dt><dd><time data-unix-time="${raid.occursAt[0]}">${raid.occursAt[0]}</time></dd><dt>Raid size</dt><dd>${raid.raidSize}</dd><dt>Signups</dt><dd>${raid.signupsOpen ? "Open" : "Closed"}</dd></dl>
        <p data-raid-action-status role="status" aria-live="polite"></p>
      </section>
      <section class="admin-section"><h2>Assigned roster</h2>${roster}</section>
      <section class="admin-section"><h2>Available capabilities</h2>${capabilityBody}</section>
      <section class="admin-section"><h2>Participation pool</h2>${pool}</section>`;

    const html = renderPage(assets, {
      pathname: request.url,
      title: `${raid.label} · Raid Administration · OH CRIT I Pulled! Guild Operations`,
      description: raid.description ?? "Raid administration.",
      viewer,
      stylesheets: ["admin.css", "raid-admin.css"],
      scripts: ["admin.js", "raid-admin.js"],
      secondaryNavigation: navigation,
      header: `<div class="admin-page-header"><h1>${htmlText(raid.label)}</h1><p class="lede">Operate signups and construct the raid roster.</p></div>`,
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
    if (typeof body.signupRowId !== "string" || typeof body.slotIndex !== "number" || typeof body.selectedSpec !== "string" || (body.selectedRole !== "tank" && body.selectedRole !== "healer" && body.selectedRole !== "damage")) {
      return reply.code(400).send({ error: "Assignment is incomplete" });
    }
    try {
      const assignmentId = await assignRaidParticipation(guildie.guildieId, {
        raidId: request.params.raidId,
        signupRowId: body.signupRowId,
        slotIndex: body.slotIndex,
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
    if (typeof request.body?.slotIndex !== "number") return reply.code(400).send({ error: "Slot is required" });
    try {
      await unassignRaidSlot(guildie.guildieId, request.params.raidId, request.body.slotIndex);
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Participant could not be unassigned" });
    }
  });
}
