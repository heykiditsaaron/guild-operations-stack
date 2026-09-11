import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { config } from "../../config.js";
import { pool } from "../../db.js";
import {
  addGoal,
  addOpportunity,
  assignOffer,
  createCoordination,
  goalCoverage,
  listApplicants,
  listAssignments,
  listOpportunities,
  registerApplicant,
  releaseAssignment,
  submitOffer,
  withdrawOffer,
} from "../../group-coordinator/index.js";
import type { ApplicantEligibility, CoordinationRole } from "../../group-coordinator/types.js";
import type { AssetRegistry } from "../assets.js";
import { htmlText, renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

type CoordinationRow = {
  coordination_id: string;
  applicant_eligibility: ApplicantEligibility;
  created_at_unix: string;
  organizer: boolean;
};

type OfferRow = {
  offer_id: string;
  applicant_id: string;
  guildie_id: string | null;
  external_label: string | null;
  character_record_id: string | null;
  character_name: string | null;
  class_name: string | null;
  spec_name: string | null;
  withdrawn_at_unix: string | null;
};

type CharacterRow = {
  character_record_id: string;
  name: string;
  realm_name: string | null;
  class_name: string | null;
  active_spec_name: string | null;
  currently_in_guild: boolean;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

async function requireGuildie(request: { cookies: Record<string, string | undefined> }) {
  const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
  if (!guildie) throw new Error("Authentication required");
  return guildie;
}

async function coordinationRows(guildieId: string): Promise<CoordinationRow[]> {
  const result = await pool.query<CoordinationRow>(
    `SELECT c.coordination_id,
            c.applicant_eligibility,
            c.created_at_unix::text,
            EXISTS (
              SELECT 1 FROM coordination_organizers o
               WHERE o.coordination_id = c.coordination_id AND o.guildie_id = $1
            ) AS organizer
       FROM coordinations c
      WHERE c.guild_id = $2
        AND (
          EXISTS (SELECT 1 FROM coordination_organizers o WHERE o.coordination_id = c.coordination_id AND o.guildie_id = $1)
          OR EXISTS (SELECT 1 FROM coordination_applicants a WHERE a.coordination_id = c.coordination_id AND a.guildie_id = $1)
        )
      ORDER BY c.created_at_unix DESC, c.coordination_id`,
    [guildieId, config.guild.id],
  );
  return result.rows;
}

async function coordinationContext(coordinationId: string, guildieId: string): Promise<CoordinationRow | null> {
  const result = await pool.query<CoordinationRow>(
    `SELECT c.coordination_id,
            c.applicant_eligibility,
            c.created_at_unix::text,
            EXISTS (
              SELECT 1 FROM coordination_organizers o
               WHERE o.coordination_id = c.coordination_id AND o.guildie_id = $2
            ) AS organizer
       FROM coordinations c
      WHERE c.coordination_id = $1 AND c.guild_id = $3`,
    [coordinationId, guildieId, config.guild.id],
  );
  return result.rows[0] ?? null;
}

async function offers(coordinationId: string): Promise<OfferRow[]> {
  const result = await pool.query<OfferRow>(
    `SELECT o.offer_id, o.applicant_id, a.guildie_id, a.external_label,
            o.character_record_id, c.name AS character_name,
            o.class_name, o.spec_name, o.withdrawn_at_unix::text
       FROM coordination_offers o
       JOIN coordination_applicants a ON a.applicant_id = o.applicant_id
       LEFT JOIN characters c ON c.character_record_id = o.character_record_id
      WHERE o.coordination_id = $1
      ORDER BY o.created_at_unix, o.offer_id`,
    [coordinationId],
  );
  return result.rows;
}

async function controlledCharacters(guildieId: string): Promise<CharacterRow[]> {
  const result = await pool.query<CharacterRow>(
    `SELECT c.character_record_id, c.name, c.realm_name,
            wcp.class_name, wcp.active_spec_name,
            EXISTS (
              SELECT 1 FROM guild_roster_memberships grm
               WHERE grm.guild_id = $2
                 AND grm.region = c.region
                 AND grm.realm_id = c.realm_id
                 AND grm.character_id = c.character_id
                 AND grm.currently_present = true
            ) AS currently_in_guild
       FROM characters c
       LEFT JOIN wow_character_profiles wcp
         ON wcp.region = c.region
        AND wcp.realm_id = c.realm_id
        AND wcp.character_id = c.character_id
      WHERE c.guildie_id = $1 AND c.currently_controlled = true
      ORDER BY currently_in_guild DESC, c.name`,
    [guildieId, config.guild.id],
  );
  return result.rows;
}

function eligibilityLabel(value: ApplicantEligibility): string {
  if (value === "guild_character") return "Guild character";
  if (value === "guildie") return "Guildie";
  return "Anyone";
}

function landing(rows: CoordinationRow[]): string {
  const existing = rows.length
    ? `<div class="coordinator-list">${rows.map((row) => `<a class="coordinator-row" href="/group-coordinator/${encodeURIComponent(row.coordination_id)}"><span class="coordinator-row-main"><strong>${htmlText(row.coordination_id.slice(0, 8))}</strong><span class="coordinator-row-meta">${eligibilityLabel(row.applicant_eligibility)} · ${row.organizer ? "Organizer" : "Applicant"}</span></span><span aria-hidden="true">→</span></a>`).join("")}</div>`
    : `<p class="coordinator-empty">No Coordinations are associated with you yet.</p>`;

  return `<div class="coordinator-shell">
    <section class="coordinator-card">
      <h2>Create test Coordination</h2>
      <p class="coordinator-note">This surface exists to pressure-test Group Coordinator itself. It does not create an Event.</p>
      <form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/create">
        <label><span>Applicant eligibility</span><select name="applicantEligibility"><option value="guild_character">Guild character</option><option value="guildie" selected>Guildie</option><option value="anyone">Anyone</option></select></label>
        <button class="button-primary" type="submit">Create Coordination</button>
        <p class="coordinator-status" data-coordinator-status></p>
      </form>
    </section>
    <section class="coordinator-card"><h2>Your Coordinations</h2>${existing}</section>
  </div>`;
}

function detailBody(input: {
  row: CoordinationRow;
  applicants: Awaited<ReturnType<typeof listApplicants>>;
  opportunities: Awaited<ReturnType<typeof listOpportunities>>;
  assignments: Awaited<ReturnType<typeof listAssignments>>;
  coverage: Awaited<ReturnType<typeof goalCoverage>>;
  offers: OfferRow[];
  characters: CharacterRow[];
  guildieId: string;
}): string {
  const ownApplicant = input.applicants.find((applicant) => applicant.guildieId === input.guildieId) ?? null;
  const activeAssignments = input.assignments.filter((assignment) => assignment.releasedAtUnix === null);
  const assignmentByOffer = new Map(activeAssignments.map((assignment) => [assignment.offerId, assignment]));
  const opportunityById = new Map(input.opportunities.map((opportunity) => [opportunity.opportunityId, opportunity]));

  const demand = input.opportunities.length
    ? `<div class="coordinator-list">${input.opportunities.map((opportunity) => {
        const filled = activeAssignments.filter((assignment) => assignment.opportunityId === opportunity.opportunityId).length;
        const capacity = opportunity.quantity === null ? "unbounded" : `${filled}/${opportunity.quantity}`;
        return `<div class="coordinator-row coordinator-opportunity"><div><strong>${htmlText(opportunity.label)}</strong><div class="coordinator-row-meta">${opportunity.requiredRole ?? "Any role"} · ${capacity}</div></div></div>`;
      }).join("")}</div>`
    : `<p class="coordinator-empty">No Opportunities defined.</p>`;

  const goals = input.coverage.length
    ? `<div class="coordinator-list">${input.coverage.map((goal) => `<div class="coordinator-row"><span><strong>${htmlText(goal.tag)}</strong><span class="coordinator-row-meta"> ${goal.current}/${goal.minimum}</span></span><span class="coordinator-badge ${goal.met ? "coordinator-badge-met" : "coordinator-badge-unmet"}">${goal.met ? "Met" : "Unmet"}</span></div>`).join("")}</div>`
    : `<p class="coordinator-empty">No Goals defined.</p>`;

  const organizerTools = input.row.organizer ? `<div class="coordinator-grid coordinator-two-column">
    <section class="coordinator-card"><h3>Add Opportunity</h3><form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/opportunities"><div class="coordinator-form-grid"><label><span>Key</span><input name="key" required></label><label><span>Label</span><input name="label" required></label><label><span>Role</span><select name="requiredRole"><option value="">Any</option><option value="tank">Tank</option><option value="healer">Healer</option><option value="damage">Damage</option></select></label><label><span>Quantity</span><input name="quantity" type="number" min="1" step="1"></label></div><button class="button-primary" type="submit">Add Opportunity</button><p class="coordinator-status" data-coordinator-status></p></form></section>
    <section class="coordinator-card"><h3>Add Goal</h3><form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/goals"><div class="coordinator-form-grid"><label><span>Capability tag</span><input name="tag" placeholder="lust" required></label><label><span>Minimum</span><input name="minimum" type="number" min="1" step="1" value="1" required></label></div><button class="button-primary" type="submit">Add Goal</button><p class="coordinator-status" data-coordinator-status></p></form></section>
  </div>` : "";

  let applicantTools = "";
  if (!ownApplicant) {
    if (input.row.applicant_eligibility === "guild_character") {
      const guildCharacters = input.characters.filter((character) => character.currently_in_guild);
      applicantTools = `<section class="coordinator-card"><h3>Join Coordination</h3><form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/join"><label><span>Qualifying guild Character</span><select name="characterRecordId" required>${guildCharacters.map((character) => `<option value="${htmlText(character.character_record_id)}">${htmlText(character.name)}${character.realm_name ? ` — ${htmlText(character.realm_name)}` : ""}</option>`).join("")}</select></label><button class="button-primary" type="submit">Join</button><p class="coordinator-status" data-coordinator-status></p></form></section>`;
    } else {
      applicantTools = `<section class="coordinator-card"><h3>Join Coordination</h3><form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/join"><button class="button-primary" type="submit">Join as yourself</button><p class="coordinator-status" data-coordinator-status></p></form></section>`;
    }
  } else {
    const characterOptions = input.characters.map((character) => `<option value="${htmlText(character.character_record_id)}">${htmlText(character.name)}${character.class_name && character.active_spec_name ? ` — ${htmlText(character.active_spec_name)} ${htmlText(character.class_name)}` : " — profile details unavailable"}</option>`).join("");
    applicantTools = `<section class="coordinator-card"><h3>Submit Offer</h3><p class="coordinator-note">Choose a controlled Character, or leave Character blank and declare class/spec. Demand is visible information; it does not constrain this offer.</p><form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/offers"><div class="coordinator-form-grid"><label><span>Character</span><select name="characterRecordId"><option value="">Declared offer</option>${characterOptions}</select></label><label><span>Class</span><input name="className" placeholder="Mage"></label><label><span>Specialization</span><input name="specName" placeholder="Fire"></label></div><button class="button-primary" type="submit">Submit Offer</button><p class="coordinator-status" data-coordinator-status></p></form></section>`;
  }

  const offerList = input.offers.length
    ? `<div class="coordinator-list">${input.offers.map((offer) => {
        const assignment = assignmentByOffer.get(offer.offer_id);
        const opportunity = assignment ? opportunityById.get(assignment.opportunityId) : null;
        const owner = offer.guildie_id === input.guildieId;
        const withdrawn = offer.withdrawn_at_unix !== null;
        const identity = offer.character_name ?? offer.external_label ?? "Declared offer";
        const assignmentText = assignment ? `Assigned → ${opportunity?.label ?? assignment.opportunityId.slice(0, 8)}` : withdrawn ? "Withdrawn" : "Unassigned";
        const organizerAssign = input.row.organizer && !assignment && !withdrawn && input.opportunities.length
          ? `<form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/assign"><input type="hidden" name="offerId" value="${htmlText(offer.offer_id)}"><label><span>Assign to</span><select name="opportunityId">${input.opportunities.map((item) => `<option value="${htmlText(item.opportunityId)}">${htmlText(item.label)}</option>`).join("")}</select></label><button type="submit">Assign</button><p class="coordinator-status" data-coordinator-status></p></form>`
          : "";
        const release = input.row.organizer && assignment
          ? `<button type="button" data-coordinator-action data-endpoint="/group-coordinator/${input.row.coordination_id}/assignments/${assignment.assignmentId}/release">Release</button>`
          : "";
        const withdraw = owner && !assignment && !withdrawn
          ? `<button type="button" data-coordinator-action data-endpoint="/group-coordinator/${input.row.coordination_id}/offers/${offer.offer_id}/withdraw">Withdraw</button>`
          : "";
        return `<div class="coordinator-row coordinator-offer"><div class="coordinator-row-main"><strong>${htmlText(identity)}</strong><span class="coordinator-row-meta">${htmlText(offer.spec_name ?? "Unknown spec")} ${htmlText(offer.class_name ?? "Unknown class")} · ${htmlText(assignmentText)}</span></div>${organizerAssign}<div class="coordinator-actions">${release}${withdraw}</div></div>`;
      }).join("")}</div>`
    : `<p class="coordinator-empty">No Offers submitted.</p>`;

  return `<div class="coordinator-shell">
    <section class="coordinator-card"><h2>Demand</h2><p class="coordinator-note">Eligibility: ${eligibilityLabel(input.row.applicant_eligibility)}${input.row.organizer ? " · You are an organizer" : ""}</p>${demand}</section>
    <section class="coordinator-card"><h2>Goals</h2>${goals}</section>
    ${organizerTools}
    ${applicantTools}
    <section class="coordinator-card"><h2>Offers & Assignments</h2>${offerList}</section>
  </div>`;
}

export async function registerGroupCoordinatorPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/group-coordinator", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([viewerForRequest(sessionToken), authenticatedGuildie(sessionToken)]);
    if (!guildie) return reply.redirect(`/auth/blizzard/start?return_to=${encodeURIComponent("/group-coordinator")}`);
    const rows = await coordinationRows(guildie.guildieId);
    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(renderPage(assets, {
      pathname: "/group-coordinator",
      title: "Group Coordinator · Guild Operations",
      description: "Internal Group Coordinator interaction surface.",
      viewer,
      stylesheets: ["group-coordinator.css"],
      scripts: ["group-coordinator.js"],
      header: `<h1>Group Coordinator</h1><p class="lede">Demand, supply, and assignment without an Event consumer.</p>`,
      body: landing(rows),
    }));
  });

  app.get<{ Params: { coordinationId: string } }>("/group-coordinator/:coordinationId", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([viewerForRequest(sessionToken), authenticatedGuildie(sessionToken)]);
    if (!guildie) return reply.redirect(`/auth/blizzard/start?return_to=${encodeURIComponent(request.url)}`);
    const row = await coordinationContext(request.params.coordinationId, guildie.guildieId);
    if (!row) return reply.code(404).send("Coordination not found");
    const [applicants, opportunities, assignments, coverage, offerRows, characters] = await Promise.all([
      listApplicants(row.coordination_id),
      listOpportunities(row.coordination_id),
      listAssignments(row.coordination_id),
      goalCoverage(row.coordination_id),
      offers(row.coordination_id),
      controlledCharacters(guildie.guildieId),
    ]);
    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(renderPage(assets, {
      pathname: `/group-coordinator/${row.coordination_id}`,
      title: "Coordination · Group Coordinator",
      description: "Internal Group Coordinator interaction surface.",
      viewer,
      secondaryNavigation: { kind: "back", label: "Group Coordinator", href: "/group-coordinator" },
      stylesheets: ["group-coordinator.css"],
      scripts: ["group-coordinator.js"],
      header: `<h1>Coordination ${htmlText(row.coordination_id.slice(0, 8))}</h1><p class="lede">Operate the reusable coordination model directly.</p>`,
      body: detailBody({ row, applicants, opportunities, assignments, coverage, offers: offerRows, characters, guildieId: guildie.guildieId }),
    }));
  });

  app.post("/group-coordinator/create", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      const body = request.body as Record<string, unknown>;
      const eligibility = text(body.applicantEligibility) as ApplicantEligibility;
      if (!["guild_character", "guildie", "anyone"].includes(eligibility)) throw new Error("Invalid applicant eligibility");
      const coordinationId = await createCoordination({ guildId: config.guild.id, applicantEligibility: eligibility, organizerGuildieIds: [guildie.guildieId] });
      return { redirect: `/group-coordinator/${coordinationId}` };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { coordinationId: string } }>("/group-coordinator/:coordinationId/opportunities", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      const body = request.body as Record<string, unknown>;
      const roleText = text(body.requiredRole);
      const role = (roleText || null) as CoordinationRole | null;
      if (role && !["tank", "healer", "damage"].includes(role)) throw new Error("Invalid role");
      const quantityText = text(body.quantity);
      await addOpportunity({ coordinationId: request.params.coordinationId, actorGuildieId: guildie.guildieId, key: text(body.key), label: text(body.label), requiredRole: role, quantity: quantityText ? integer(quantityText) : null });
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { coordinationId: string } }>("/group-coordinator/:coordinationId/goals", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      const body = request.body as Record<string, unknown>;
      const minimum = integer(body.minimum);
      if (minimum === null) throw new Error("Minimum must be an integer");
      await addGoal({ coordinationId: request.params.coordinationId, actorGuildieId: guildie.guildieId, tag: text(body.tag), minimum });
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { coordinationId: string } }>("/group-coordinator/:coordinationId/join", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      const row = await coordinationContext(request.params.coordinationId, guildie.guildieId);
      if (!row) throw new Error("Coordination not found");
      const body = request.body as Record<string, unknown>;
      if (row.applicant_eligibility === "guild_character") {
        await registerApplicant({ coordinationId: row.coordination_id, source: "guild_character", guildieId: guildie.guildieId, characterRecordId: text(body.characterRecordId) });
      } else {
        await registerApplicant({ coordinationId: row.coordination_id, source: "guildie", guildieId: guildie.guildieId });
      }
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { coordinationId: string } }>("/group-coordinator/:coordinationId/offers", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      const applicants = await listApplicants(request.params.coordinationId);
      const applicant = applicants.find((item) => item.guildieId === guildie.guildieId);
      if (!applicant) throw new Error("Join this Coordination before submitting an Offer");
      const body = request.body as Record<string, unknown>;
      await submitOffer({ coordinationId: request.params.coordinationId, applicantId: applicant.applicantId, characterRecordId: text(body.characterRecordId) || null, className: text(body.className) || null, specName: text(body.specName) || null });
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { coordinationId: string } }>("/group-coordinator/:coordinationId/assign", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      const body = request.body as Record<string, unknown>;
      await assignOffer({ coordinationId: request.params.coordinationId, actorGuildieId: guildie.guildieId, offerId: text(body.offerId), opportunityId: text(body.opportunityId) });
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { coordinationId: string; assignmentId: string } }>("/group-coordinator/:coordinationId/assignments/:assignmentId/release", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      await releaseAssignment({ coordinationId: request.params.coordinationId, actorGuildieId: guildie.guildieId, assignmentId: request.params.assignmentId });
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { coordinationId: string; offerId: string } }>("/group-coordinator/:coordinationId/offers/:offerId/withdraw", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      const applicants = await listApplicants(request.params.coordinationId);
      const applicant = applicants.find((item) => item.guildieId === guildie.guildieId);
      if (!applicant) throw new Error("Applicant not found");
      await withdrawOffer({ coordinationId: request.params.coordinationId, applicantId: applicant.applicantId, offerId: request.params.offerId });
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}
