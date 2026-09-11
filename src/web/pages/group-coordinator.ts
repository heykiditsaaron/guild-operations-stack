import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { config } from "../../config.js";
import { pool } from "../../db.js";
import {
  addGoal,
  addOpportunity,
  allCapabilityTags,
  assignOffer,
  createCoordination,
  getSpecDefinition,
  goalCoverage,
  listApplicants,
  listAssignments,
  listOpportunities,
  registerApplicant,
  releaseAssignment,
  submitOffer,
  updateCoordinationApplicantEligibility,
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

function roleLabel(role: CoordinationRole): string {
  if (role === "tank") return "Tank";
  if (role === "healer") return "Healer";
  return "Damage";
}

function capabilityLabel(tag: string): string {
  return tag.split("_").map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join(" ");
}

function offerIdentity(offer: OfferRow): string {
  const declared = [offer.spec_name, offer.class_name].filter(Boolean).join(" ");
  return offer.character_name ?? offer.external_label ?? (declared || "Declared offer");
}

function offerMeta(offer: OfferRow): string {
  return [offer.spec_name, offer.class_name].filter(Boolean).join(" ") || "Coordination offer";
}

function eligibilityOptions(selected: ApplicantEligibility): string {
  return ([
    ["guild_character", "Guild character"],
    ["guildie", "Guildie"],
    ["anyone", "Anyone"],
  ] as const).map(([value, label]) => `<option value="${value}"${selected === value ? " selected" : ""}>${label}</option>`).join("");
}

function landing(rows: CoordinationRow[]): string {
  const existing = rows.length
    ? `<div class="coordinator-list">${rows.map((row) => {
        const href = row.organizer
          ? `/group-coordinator/${encodeURIComponent(row.coordination_id)}`
          : `/group-coordinator/${encodeURIComponent(row.coordination_id)}/participate`;
        return `<a class="coordinator-row" href="${href}"><span class="coordinator-row-main"><strong>${htmlText(row.coordination_id.slice(0, 8))}</strong><span class="coordinator-row-meta">${eligibilityLabel(row.applicant_eligibility)} · ${row.organizer ? "Organizer" : "Applicant"}</span></span><span aria-hidden="true">→</span></a>`;
      }).join("")}</div>`
    : `<p class="coordinator-empty">No Coordinations are associated with you yet.</p>`;

  return `<div class="coordinator-shell">
    <section class="coordinator-card">
      <h2>Create test Coordination</h2>
      <p class="coordinator-note">This surface exists to pressure-test Group Coordinator itself. It does not create an Event.</p>
      <form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/create">
        <label><span>Applicant eligibility</span><select name="applicantEligibility">${eligibilityOptions("guildie")}</select></label>
        <button class="button-primary" type="submit">Create Coordination</button>
        <p class="coordinator-status" data-coordinator-status></p>
      </form>
    </section>
    <section class="coordinator-card"><h2>Your Coordinations</h2>${existing}</section>
  </div>`;
}

function demandList(
  opportunities: Awaited<ReturnType<typeof listOpportunities>>,
  assignments: Awaited<ReturnType<typeof listAssignments>>,
): string {
  const activeAssignments = assignments.filter((assignment) => assignment.releasedAtUnix === null);
  if (!opportunities.length) return `<p class="coordinator-empty">No slots defined.</p>`;
  return `<div class="coordinator-list">${opportunities.map((opportunity) => {
    const filled = activeAssignments.filter((assignment) => assignment.opportunityId === opportunity.opportunityId).length;
    const capacity = opportunity.quantity === null ? `${filled}` : `${filled}/${opportunity.quantity}`;
    const role = opportunity.requiredRole ? roleLabel(opportunity.requiredRole) : opportunity.label;
    return `<div class="coordinator-row coordinator-opportunity"><div><strong>${htmlText(role)}</strong><div class="coordinator-row-meta">${capacity} assigned</div></div></div>`;
  }).join("")}</div>`;
}

function goalList(coverage: Awaited<ReturnType<typeof goalCoverage>>): string {
  if (!coverage.length) return `<p class="coordinator-empty">No Goals defined.</p>`;
  return `<div class="coordinator-list">${coverage.map((goal) => `<div class="coordinator-row"><span><strong>${htmlText(capabilityLabel(goal.tag))}</strong><span class="coordinator-row-meta"> ${goal.current}/${goal.minimum}</span></span><span class="coordinator-badge ${goal.met ? "coordinator-badge-met" : "coordinator-badge-unmet"}">${goal.met ? "Met" : "Unmet"}</span></div>`).join("")}</div>`;
}

function organizerBody(input: {
  row: CoordinationRow;
  opportunities: Awaited<ReturnType<typeof listOpportunities>>;
  assignments: Awaited<ReturnType<typeof listAssignments>>;
  coverage: Awaited<ReturnType<typeof goalCoverage>>;
  offers: OfferRow[];
}): string {
  const activeAssignments = input.assignments.filter((assignment) => assignment.releasedAtUnix === null);
  const assignmentByOffer = new Map(activeAssignments.map((assignment) => [assignment.offerId, assignment]));
  const offersById = new Map(input.offers.map((offer) => [offer.offer_id, offer]));
  const availableOffers = input.offers.filter((offer) => offer.withdrawn_at_unix === null && !assignmentByOffer.has(offer.offer_id));

  const assignments = input.opportunities.length
    ? `<div class="coordinator-list">${input.opportunities.map((opportunity) => {
        const assigned = activeAssignments.filter((assignment) => assignment.opportunityId === opportunity.opportunityId);
        const quantity = opportunity.quantity ?? assigned.length;
        const open = opportunity.quantity === null || assigned.length < opportunity.quantity;
        const role = opportunity.requiredRole;
        const compatible = availableOffers.filter((offer) => {
          if (!role || !offer.class_name || !offer.spec_name) return !role;
          return getSpecDefinition(offer.class_name, offer.spec_name)?.role === role;
        });
        const assignedRows = assigned.map((assignment) => {
          const offer = offersById.get(assignment.offerId);
          if (!offer) return "";
          return `<div class="coordinator-row coordinator-offer"><div class="coordinator-row-main"><strong>${htmlText(offerIdentity(offer))}</strong><span class="coordinator-row-meta">${htmlText(offerMeta(offer))}</span></div><div class="coordinator-actions"><button type="button" data-coordinator-action data-endpoint="/group-coordinator/${input.row.coordination_id}/assignments/${assignment.assignmentId}/release">Release</button></div></div>`;
        }).join("");
        const assignForm = open
          ? compatible.length
            ? `<form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/assign"><input type="hidden" name="opportunityId" value="${htmlText(opportunity.opportunityId)}"><label><span>Assign next</span><select name="offerId">${compatible.map((offer) => `<option value="${htmlText(offer.offer_id)}">${htmlText(offerIdentity(offer))} — ${htmlText(offerMeta(offer))}</option>`).join("")}</select></label><button type="submit">Assign</button><p class="coordinator-status" data-coordinator-status></p></form>`
            : `<p class="coordinator-empty">No compatible unassigned offers.</p>`
          : "";
        return `<section class="coordinator-assignment-group"><div class="coordinator-assignment-heading"><strong>${htmlText(role ? roleLabel(role) : opportunity.label)}</strong><span>${assigned.length}/${quantity} assigned</span></div>${assignedRows || '<p class="coordinator-empty">No assignments yet.</p>'}${assignForm}</section>`;
      }).join("")}</div>`
    : `<p class="coordinator-empty">Define slots before assigning applicants.</p>`;

  const capabilityOptions = allCapabilityTags().map((tag) => `<option value="${htmlText(tag)}">${htmlText(capabilityLabel(tag))}</option>`).join("");

  return `<div class="coordinator-shell">
    <section class="coordinator-card">
      <div class="coordinator-card-heading"><div><h2>Demand</h2><p class="coordinator-note">Define who may apply and the slots you intend to fill.</p></div><a href="/group-coordinator/${input.row.coordination_id}/participate">Open participant view →</a></div>
      <form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/eligibility"><label><span>Applicant eligibility</span><select name="applicantEligibility">${eligibilityOptions(input.row.applicant_eligibility)}</select></label><button type="submit">Update eligibility</button><p class="coordinator-status" data-coordinator-status></p></form>
      ${demandList(input.opportunities, input.assignments)}
    </section>
    <section class="coordinator-card"><h2>Goals</h2>${goalList(input.coverage)}</section>
    <div class="coordinator-grid coordinator-two-column">
      <section class="coordinator-card"><h3>Add slots</h3><form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/opportunities"><div class="coordinator-form-grid"><label><span>Slot type</span><select name="requiredRole" required><option value="tank">Tank</option><option value="healer">Healer</option><option value="damage">Damage</option></select></label><label><span>Quantity</span><input name="quantity" type="number" min="1" step="1" value="1" required></label></div><button class="button-primary" type="submit">Add slots</button><p class="coordinator-status" data-coordinator-status></p></form></section>
      <section class="coordinator-card"><h3>Add Goal</h3><form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/goals"><div class="coordinator-form-grid"><label><span>Capability</span><select name="tag" required>${capabilityOptions}</select></label><label><span>Minimum</span><input name="minimum" type="number" min="1" step="1" value="1" required></label></div><button class="button-primary" type="submit">Add Goal</button><p class="coordinator-status" data-coordinator-status></p></form></section>
    </div>
    <section class="coordinator-card"><h2>Assignments</h2>${assignments}</section>
  </div>`;
}

function participantBody(input: {
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
  const ownOffers = ownApplicant ? input.offers.filter((offer) => offer.applicant_id === ownApplicant.applicantId) : [];

  let participation = "";
  if (!ownApplicant) {
    if (input.row.applicant_eligibility === "guild_character") {
      const guildCharacters = input.characters.filter((character) => character.currently_in_guild);
      participation = `<section class="coordinator-card"><h2>Join</h2><p class="coordinator-note">This Coordination requires a currently controlled guild-roster Character to establish applicant eligibility.</p><form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/join"><label><span>Qualifying guild Character</span><select name="characterRecordId" required>${guildCharacters.map((character) => `<option value="${htmlText(character.character_record_id)}">${htmlText(character.name)}${character.realm_name ? ` — ${htmlText(character.realm_name)}` : ""}</option>`).join("")}</select></label><button class="button-primary" type="submit">Join</button><p class="coordinator-status" data-coordinator-status></p></form></section>`;
    } else {
      participation = `<section class="coordinator-card"><h2>Join</h2><p class="coordinator-note">Eligibility: ${eligibilityLabel(input.row.applicant_eligibility)}</p><form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/join"><button class="button-primary" type="submit">Join as yourself</button><p class="coordinator-status" data-coordinator-status></p></form></section>`;
    }
  } else {
    const characterOptions = input.characters.map((character) => `<option value="${htmlText(character.character_record_id)}">${htmlText(character.name)}${character.class_name && character.active_spec_name ? ` — ${htmlText(character.active_spec_name)} ${htmlText(character.class_name)}` : " — profile details unavailable"}</option>`).join("");
    participation = `<section class="coordinator-card"><h2>Submit Offer</h2><p class="coordinator-note">Offer what you can bring. The organizer's demand is information, not a restriction on your offer.</p><form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/offers"><div class="coordinator-form-grid"><label><span>Character</span><select name="characterRecordId"><option value="">Declared offer</option>${characterOptions}</select></label><label><span>Class</span><input name="className" placeholder="Mage"></label><label><span>Specialization</span><input name="specName" placeholder="Fire"></label></div><button class="button-primary" type="submit">Submit Offer</button><p class="coordinator-status" data-coordinator-status></p></form></section>`;
  }

  const ownOfferList = ownApplicant
    ? ownOffers.length
      ? `<div class="coordinator-list">${ownOffers.map((offer) => {
          const assignment = assignmentByOffer.get(offer.offer_id);
          const opportunity = assignment ? opportunityById.get(assignment.opportunityId) : null;
          const withdrawn = offer.withdrawn_at_unix !== null;
          const status = assignment ? `Assigned · ${opportunity?.requiredRole ? roleLabel(opportunity.requiredRole) : opportunity?.label ?? "Slot"}` : withdrawn ? "Withdrawn" : "Offered";
          const withdraw = !assignment && !withdrawn ? `<button type="button" data-coordinator-action data-endpoint="/group-coordinator/${input.row.coordination_id}/offers/${offer.offer_id}/withdraw">Withdraw</button>` : "";
          return `<div class="coordinator-row coordinator-offer"><div class="coordinator-row-main"><strong>${htmlText(offerIdentity(offer))}</strong><span class="coordinator-row-meta">${htmlText(offerMeta(offer))} · ${htmlText(status)}</span></div><div class="coordinator-actions">${withdraw}</div></div>`;
        }).join("")}</div>`
      : `<p class="coordinator-empty">You have not submitted an Offer.</p>`
    : `<p class="coordinator-empty">Join before submitting an Offer.</p>`;

  return `<div class="coordinator-shell">
    <section class="coordinator-card"><h2>Demand</h2><p class="coordinator-note">Eligibility: ${eligibilityLabel(input.row.applicant_eligibility)}</p>${demandList(input.opportunities, input.assignments)}</section>
    <section class="coordinator-card"><h2>Goals</h2>${goalList(input.coverage)}</section>
    ${participation}
    <section class="coordinator-card"><h2>Your Offers</h2>${ownOfferList}</section>
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
    if (!row.organizer) return reply.redirect(`/group-coordinator/${encodeURIComponent(row.coordination_id)}/participate`);
    const [opportunities, assignments, coverage, offerRows] = await Promise.all([
      listOpportunities(row.coordination_id),
      listAssignments(row.coordination_id),
      goalCoverage(row.coordination_id),
      offers(row.coordination_id),
    ]);
    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(renderPage(assets, {
      pathname: `/group-coordinator/${row.coordination_id}`,
      title: "Coordination · Group Coordinator",
      description: "Internal Group Coordinator organizer surface.",
      viewer,
      secondaryNavigation: { kind: "back", label: "Group Coordinator", href: "/group-coordinator" },
      stylesheets: ["group-coordinator.css"],
      scripts: ["group-coordinator.js"],
      header: `<h1>Coordination ${htmlText(row.coordination_id.slice(0, 8))}</h1><p class="lede">Author demand and reconcile it through assignment.</p>`,
      body: organizerBody({ row, opportunities, assignments, coverage, offers: offerRows }),
    }));
  });

  app.get<{ Params: { coordinationId: string } }>("/group-coordinator/:coordinationId/participate", async (request, reply) => {
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
      pathname: `/group-coordinator/${row.coordination_id}/participate`,
      title: "Participate · Group Coordinator",
      description: "Internal Group Coordinator participant surface.",
      viewer,
      secondaryNavigation: row.organizer
        ? { kind: "back", label: "Organizer view", href: `/group-coordinator/${row.coordination_id}` }
        : { kind: "back", label: "Group Coordinator", href: "/group-coordinator" },
      stylesheets: ["group-coordinator.css"],
      scripts: ["group-coordinator.js"],
      header: `<h1>Participate</h1><p class="lede">Read the demand and offer what you can bring.</p>`,
      body: participantBody({ row, applicants, opportunities, assignments, coverage, offers: offerRows, characters, guildieId: guildie.guildieId }),
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

  app.post<{ Params: { coordinationId: string } }>("/group-coordinator/:coordinationId/eligibility", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      const body = request.body as Record<string, unknown>;
      const eligibility = text(body.applicantEligibility) as ApplicantEligibility;
      if (!["guild_character", "guildie", "anyone"].includes(eligibility)) throw new Error("Invalid applicant eligibility");
      await updateCoordinationApplicantEligibility({ coordinationId: request.params.coordinationId, actorGuildieId: guildie.guildieId, applicantEligibility: eligibility });
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { coordinationId: string } }>("/group-coordinator/:coordinationId/opportunities", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      const body = request.body as Record<string, unknown>;
      const role = text(body.requiredRole) as CoordinationRole;
      if (!["tank", "healer", "damage"].includes(role)) throw new Error("Invalid slot type");
      const quantity = integer(body.quantity);
      if (quantity === null || quantity <= 0) throw new Error("Quantity must be a positive integer");
      await addOpportunity({
        coordinationId: request.params.coordinationId,
        actorGuildieId: guildie.guildieId,
        key: `slot-${role}-${randomUUID()}`,
        label: roleLabel(role),
        requiredRole: role,
        quantity,
      });
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { coordinationId: string } }>("/group-coordinator/:coordinationId/goals", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      const body = request.body as Record<string, unknown>;
      const tag = text(body.tag);
      if (!allCapabilityTags().includes(tag)) throw new Error("Unknown capability");
      const minimum = integer(body.minimum);
      if (minimum === null || minimum <= 0) throw new Error("Minimum must be a positive integer");
      await addGoal({ coordinationId: request.params.coordinationId, actorGuildieId: guildie.guildieId, tag, minimum });
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
