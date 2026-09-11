import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { config } from "../../config.js";
import { pool } from "../../db.js";
import {
  addCoordinationRoleSlot,
  addGoal,
  allCapabilityTags,
  assignOffer,
  createCoordination,
  getSpecDefinition,
  goalCoverage,
  listActiveCoordinationOpportunities,
  listApplicants,
  listAssignments,
  listCoordinationGoals,
  registerApplicant,
  releaseAssignment,
  removeCoordinationGoal,
  removeCoordinationRoleSlot,
  submitOffer,
  updateCoordinationApplicantEligibility,
  updateCoordinationGoalMinimum,
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
               WHERE o.coordination_id = c.coordination_id
                 AND o.guildie_id = $1
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
               WHERE o.coordination_id = c.coordination_id
                 AND o.guildie_id = $2
            ) AS organizer
       FROM coordinations c
      WHERE c.coordination_id = $1
        AND c.guild_id = $3`,
    [coordinationId, guildieId, config.guild.id],
  );
  return result.rows[0] ?? null;
}

async function offers(coordinationId: string): Promise<OfferRow[]> {
  const result = await pool.query<OfferRow>(
    `SELECT o.offer_id,
            o.applicant_id,
            a.guildie_id,
            a.external_label,
            o.character_record_id,
            c.name AS character_name,
            o.class_name,
            o.spec_name,
            o.withdrawn_at_unix::text
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
    `SELECT c.character_record_id,
            c.name,
            c.realm_name,
            wcp.class_name,
            wcp.active_spec_name,
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
      WHERE c.guildie_id = $1
        AND c.currently_controlled = true
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

function eligibilityOptions(selected: ApplicantEligibility): string {
  return ([
    ["guild_character", "Guild character"],
    ["guildie", "Guildie"],
    ["anyone", "Anyone"],
  ] as const)
    .map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`)
    .join("");
}

function roleLabel(role: CoordinationRole): string {
  if (role === "tank") return "Tank";
  if (role === "healer") return "Healer";
  return "Damage";
}

function capabilityLabel(tag: string): string {
  return tag
    .split("_")
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(" ");
}

function offerIdentity(offer: OfferRow): string {
  const declared = [offer.spec_name, offer.class_name].filter(Boolean).join(" ");
  return offer.character_name ?? offer.external_label ?? (declared || "Declared offer");
}

function offerMeta(offer: OfferRow): string {
  return [offer.spec_name, offer.class_name].filter(Boolean).join(" ") || "Coordination offer";
}

function landing(rows: CoordinationRow[]): string {
  const existing = rows.length
    ? `<div class="coordinator-list">${rows.map((row) => {
        const href = row.organizer
          ? `/group-coordinator/${encodeURIComponent(row.coordination_id)}`
          : `/group-coordinator/${encodeURIComponent(row.coordination_id)}/participate`;
        return `<a class="coordinator-row" href="${href}">
          <span class="coordinator-row-main">
            <strong>${htmlText(row.coordination_id.slice(0, 8))}</strong>
            <span class="coordinator-row-meta">${eligibilityLabel(row.applicant_eligibility)} · ${row.organizer ? "Organizer" : "Applicant"}</span>
          </span>
          <span aria-hidden="true">→</span>
        </a>`;
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

function roleCompatible(offer: OfferRow, role: CoordinationRole | null): boolean {
  if (!role) return true;
  if (!offer.class_name || !offer.spec_name) return false;
  return getSpecDefinition(offer.class_name, offer.spec_name)?.role === role;
}

function composerBody(input: {
  row: CoordinationRow;
  opportunities: Awaited<ReturnType<typeof listActiveCoordinationOpportunities>>;
  assignments: Awaited<ReturnType<typeof listAssignments>>;
  goals: Awaited<ReturnType<typeof listCoordinationGoals>>;
  coverage: Awaited<ReturnType<typeof goalCoverage>>;
  offers: OfferRow[];
}): string {
  const activeAssignments = input.assignments.filter((assignment) => assignment.releasedAtUnix === null);
  const assignedOfferIds = new Set(activeAssignments.map((assignment) => assignment.offerId));
  const offersById = new Map(input.offers.map((offer) => [offer.offer_id, offer]));
  const coverageByGoal = new Map(input.coverage.map((goal) => [goal.goalId, goal]));
  const availableOffers = input.offers.filter((offer) => offer.withdrawn_at_unix === null && !assignedOfferIds.has(offer.offer_id));

  const requirements = input.goals.length
    ? `<div class="composer-requirements">${input.goals.map((goal) => {
        const state = coverageByGoal.get(goal.goalId);
        const current = state?.current ?? 0;
        const met = state?.met ?? false;
        const decrease = goal.minimum > 1
          ? `<form data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/goals/${goal.goalId}/minimum"><input type="hidden" name="minimum" value="${goal.minimum - 1}"><button type="submit" aria-label="Decrease ${htmlText(capabilityLabel(goal.tag))} requirement">−</button></form>`
          : "";
        return `<div class="composer-requirement${met ? " composer-requirement-met" : ""}">
          <div class="composer-requirement-copy"><strong>${htmlText(capabilityLabel(goal.tag))}</strong><span>${current}/${goal.minimum}</span></div>
          <div class="composer-requirement-actions">
            ${decrease}
            <form data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/goals/${goal.goalId}/minimum"><input type="hidden" name="minimum" value="${goal.minimum + 1}"><button type="submit" aria-label="Increase ${htmlText(capabilityLabel(goal.tag))} requirement">+</button></form>
            <button type="button" data-coordinator-action data-endpoint="/group-coordinator/${input.row.coordination_id}/goals/${goal.goalId}/remove" aria-label="Remove ${htmlText(capabilityLabel(goal.tag))} requirement">×</button>
          </div>
        </div>`;
      }).join("")}</div>`
    : `<p class="coordinator-empty">No group requirements yet.</p>`;

  const usedTags = new Set(input.goals.map((goal) => goal.tag));
  const unusedTags = allCapabilityTags().filter((tag) => !usedTags.has(tag));
  const requirementPalette = unusedTags.length
    ? `<form class="composer-palette-add" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/goals">
        <select name="tag" aria-label="Requirement">${unusedTags.map((tag) => `<option value="${htmlText(tag)}">${htmlText(capabilityLabel(tag))}</option>`).join("")}</select>
        <input type="hidden" name="minimum" value="1">
        <button type="submit">+ Requirement</button>
        <p class="coordinator-status" data-coordinator-status></p>
      </form>`
    : `<span class="composer-palette-complete">All available requirements are on the canvas.</span>`;

  const canvas = input.opportunities.length
    ? `<div class="composer-canvas">${input.opportunities.map((opportunity) => {
        const assigned = activeAssignments.filter((assignment) => assignment.opportunityId === opportunity.opportunityId);
        const quantity = opportunity.quantity ?? Math.max(assigned.length, 1);
        const role = opportunity.requiredRole;
        const compatible = availableOffers.filter((offer) => roleCompatible(offer, role));
        const slots = Array.from({ length: quantity }, (_, index) => {
          const assignment = assigned[index];
          if (assignment) {
            const offer = offersById.get(assignment.offerId);
            if (!offer) return "";
            return `<article class="composer-slot composer-slot-filled">
              <div class="composer-slot-state">Assigned</div>
              <div class="composer-slot-person"><strong>${htmlText(offerIdentity(offer))}</strong><span>${htmlText(offerMeta(offer))}</span></div>
              <button type="button" data-coordinator-action data-endpoint="/group-coordinator/${input.row.coordination_id}/assignments/${assignment.assignmentId}/release">Release</button>
            </article>`;
          }

          const assignmentControl = compatible.length
            ? `<form class="composer-slot-assignment" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/assign">
                <input type="hidden" name="opportunityId" value="${htmlText(opportunity.opportunityId)}">
                <select name="offerId" aria-label="Compatible offer">${compatible.map((offer) => `<option value="${htmlText(offer.offer_id)}">${htmlText(offerIdentity(offer))} — ${htmlText(offerMeta(offer))}</option>`).join("")}</select>
                <button type="submit">Assign</button>
                <p class="coordinator-status" data-coordinator-status></p>
              </form>`
            : `<span class="composer-slot-empty-note">No compatible offers yet</span>`;

          return `<article class="composer-slot composer-slot-empty">
            <div class="composer-slot-state">Empty</div>
            ${assignmentControl}
            <button class="composer-slot-remove" type="button" data-coordinator-action data-endpoint="/group-coordinator/${input.row.coordination_id}/slots/${opportunity.opportunityId}/remove">Remove slot</button>
          </article>`;
        }).join("");

        return `<section class="composer-role-group">
          <div class="composer-role-heading"><h3>${htmlText(role ? roleLabel(role) : opportunity.label)}</h3><span>${assigned.length}/${quantity} assigned</span></div>
          <div class="composer-slots">${slots}</div>
        </section>`;
      }).join("")}</div>`
    : `<div class="composer-empty-canvas"><strong>Your group canvas is empty.</strong><span>Add a slot from the palette to begin composing.</span></div>`;

  const rolePalette = (["tank", "healer", "damage"] as const)
    .map((role) => `<form data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/slots"><input type="hidden" name="role" value="${role}"><button class="composer-palette-button" type="submit">+ ${roleLabel(role)}</button><p class="coordinator-status" data-coordinator-status></p></form>`)
    .join("");

  return `<div class="coordinator-shell composer-shell">
    <section class="composer-policy coordinator-card">
      <div>
        <span class="composer-eyebrow">Participation</span>
        <h2>Who may apply?</h2>
      </div>
      <form class="composer-policy-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/eligibility">
        <select name="applicantEligibility">${eligibilityOptions(input.row.applicant_eligibility)}</select>
        <button type="submit">Save</button>
        <p class="coordinator-status" data-coordinator-status></p>
      </form>
      <a class="composer-participant-link" href="/group-coordinator/${input.row.coordination_id}/participate">Open participant view →</a>
    </section>

    <section class="composer-workspace coordinator-card">
      <div class="composer-workspace-heading">
        <div><span class="composer-eyebrow">Canvas</span><h2>Group composition</h2><p class="coordinator-note">Build the shape, then fill it from compatible offers.</p></div>
      </div>

      <div class="composer-requirements-area">
        <div class="composer-section-heading"><h3>Group requirements</h3><span>Properties of the assembled group</span></div>
        ${requirements}
      </div>

      ${canvas}

      <aside class="composer-palette" aria-label="Composition palette">
        <div class="composer-palette-block">
          <div><span class="composer-eyebrow">Palette</span><h3>Add slots</h3></div>
          <div class="composer-palette-buttons">${rolePalette}</div>
        </div>
        <div class="composer-palette-block">
          <div><span class="composer-eyebrow">Palette</span><h3>Add requirement</h3></div>
          ${requirementPalette}
        </div>
      </aside>
    </section>
  </div>`;
}

function participantDemand(
  opportunities: Awaited<ReturnType<typeof listActiveCoordinationOpportunities>>,
  assignments: Awaited<ReturnType<typeof listAssignments>>,
  coverage: Awaited<ReturnType<typeof goalCoverage>>,
): string {
  const activeAssignments = assignments.filter((assignment) => assignment.releasedAtUnix === null);
  const slots = opportunities.length
    ? opportunities.map((opportunity) => {
        const assigned = activeAssignments.filter((assignment) => assignment.opportunityId === opportunity.opportunityId).length;
        const quantity = opportunity.quantity ?? assigned;
        return `<span class="participant-demand-chip"><strong>${htmlText(opportunity.requiredRole ? roleLabel(opportunity.requiredRole) : opportunity.label)}</strong> ${assigned}/${quantity}</span>`;
      }).join("")
    : `<span class="coordinator-empty">No slots defined yet.</span>`;
  const requirements = coverage.length
    ? coverage.map((goal) => `<span class="participant-demand-chip${goal.met ? " participant-demand-chip-met" : ""}"><strong>${htmlText(capabilityLabel(goal.tag))}</strong> ${goal.current}/${goal.minimum}</span>`).join("")
    : "";
  return `<div class="participant-demand"><div class="participant-demand-row">${slots}</div>${requirements ? `<div class="participant-demand-row">${requirements}</div>` : ""}</div>`;
}

function participantBody(input: {
  row: CoordinationRow;
  applicants: Awaited<ReturnType<typeof listApplicants>>;
  opportunities: Awaited<ReturnType<typeof listActiveCoordinationOpportunities>>;
  assignments: Awaited<ReturnType<typeof listAssignments>>;
  coverage: Awaited<ReturnType<typeof goalCoverage>>;
  offers: OfferRow[];
  characters: CharacterRow[];
  guildieId: string;
}): string {
  const applicant = input.applicants.find((item) => item.guildieId === input.guildieId) ?? null;
  const ownOffers = applicant ? input.offers.filter((offer) => offer.applicant_id === applicant.applicantId) : [];
  const activeAssignmentOfferIds = new Set(
    input.assignments.filter((assignment) => assignment.releasedAtUnix === null).map((assignment) => assignment.offerId),
  );

  let participation: string;
  if (!applicant) {
    if (input.row.applicant_eligibility === "guild_character") {
      const guildCharacters = input.characters.filter((character) => character.currently_in_guild);
      participation = `<section class="coordinator-card"><h2>Join</h2><form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/join"><label><span>Qualifying guild Character</span><select name="characterRecordId" required>${guildCharacters.map((character) => `<option value="${htmlText(character.character_record_id)}">${htmlText(character.name)}${character.realm_name ? ` — ${htmlText(character.realm_name)}` : ""}</option>`).join("")}</select></label><button type="submit">Join</button><p class="coordinator-status" data-coordinator-status></p></form></section>`;
    } else {
      participation = `<section class="coordinator-card"><h2>Join</h2><p class="coordinator-note">Eligibility: ${eligibilityLabel(input.row.applicant_eligibility)}</p><form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/join"><button type="submit">Join as yourself</button><p class="coordinator-status" data-coordinator-status></p></form></section>`;
    }
  } else {
    const characterOptions = input.characters.map((character) => `<option value="${htmlText(character.character_record_id)}">${htmlText(character.name)}${character.class_name && character.active_spec_name ? ` — ${htmlText(character.active_spec_name)} ${htmlText(character.class_name)}` : " — profile details unavailable"}</option>`).join("");
    participation = `<section class="coordinator-card"><h2>Offer what you can bring</h2><p class="coordinator-note">The group shape is information, not a restriction on your offer.</p><form class="coordinator-form" data-coordinator-form data-endpoint="/group-coordinator/${input.row.coordination_id}/offers"><div class="coordinator-form-grid"><label><span>Character</span><select name="characterRecordId"><option value="">Declared offer</option>${characterOptions}</select></label><label><span>Class</span><input name="className" placeholder="Mage"></label><label><span>Specialization</span><input name="specName" placeholder="Fire"></label></div><button type="submit">Submit Offer</button><p class="coordinator-status" data-coordinator-status></p></form></section>`;
  }

  const offerList = ownOffers.length
    ? `<div class="coordinator-list">${ownOffers.map((offer) => {
        const assigned = activeAssignmentOfferIds.has(offer.offer_id);
        const withdrawn = offer.withdrawn_at_unix !== null;
        const action = !assigned && !withdrawn
          ? `<button type="button" data-coordinator-action data-endpoint="/group-coordinator/${input.row.coordination_id}/offers/${offer.offer_id}/withdraw">Withdraw</button>`
          : "";
        return `<div class="coordinator-row"><span class="coordinator-row-main"><strong>${htmlText(offerIdentity(offer))}</strong><span class="coordinator-row-meta">${htmlText(offerMeta(offer))} · ${assigned ? "Assigned" : withdrawn ? "Withdrawn" : "Available"}</span></span>${action}</div>`;
      }).join("")}</div>`
    : `<p class="coordinator-empty">You have not submitted any Offers.</p>`;

  return `<div class="coordinator-shell">
    <section class="coordinator-card"><div class="coordinator-card-heading"><div><h2>Group shape</h2><p class="coordinator-note">What the organizer is currently assembling.</p></div>${input.row.organizer ? `<a href="/group-coordinator/${input.row.coordination_id}">Open composer →</a>` : ""}</div>${participantDemand(input.opportunities, input.assignments, input.coverage)}</section>
    ${participation}
    ${applicant ? `<section class="coordinator-card"><h2>Your Offers</h2>${offerList}</section>` : ""}
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
      header: `<h1>Group Coordinator</h1><p class="lede">Pressure-test reusable group coordination directly.</p>`,
      body: landing(rows),
    }));
  });

  app.get<{ Params: { coordinationId: string } }>("/group-coordinator/:coordinationId", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([viewerForRequest(sessionToken), authenticatedGuildie(sessionToken)]);
    if (!guildie) return reply.redirect(`/auth/blizzard/start?return_to=${encodeURIComponent(request.url)}`);
    const row = await coordinationContext(request.params.coordinationId, guildie.guildieId);
    if (!row) return reply.code(404).send("Coordination not found");
    if (!row.organizer) return reply.redirect(`/group-coordinator/${row.coordination_id}/participate`);

    const [opportunities, assignments, goals, coverage, offerRows] = await Promise.all([
      listActiveCoordinationOpportunities(row.coordination_id),
      listAssignments(row.coordination_id),
      listCoordinationGoals(row.coordination_id),
      goalCoverage(row.coordination_id),
      offers(row.coordination_id),
    ]);

    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(renderPage(assets, {
      pathname: `/group-coordinator/${row.coordination_id}`,
      title: "Group Composer · Guild Operations",
      description: "Internal Group Coordinator composition surface.",
      viewer,
      secondaryNavigation: { kind: "back", label: "Group Coordinator", href: "/group-coordinator" },
      stylesheets: ["group-coordinator.css"],
      scripts: ["group-coordinator.js"],
      header: `<h1>Group Composer</h1><p class="lede">Shape the group, then reconcile applicant supply into it.</p>`,
      body: composerBody({ row, opportunities, assignments, goals, coverage, offers: offerRows }),
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
      listActiveCoordinationOpportunities(row.coordination_id),
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
      secondaryNavigation: { kind: "back", label: "Group Coordinator", href: "/group-coordinator" },
      stylesheets: ["group-coordinator.css"],
      scripts: ["group-coordinator.js"],
      header: `<h1>Participate</h1><p class="lede">See the group shape and offer what you can bring.</p>`,
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

  app.post<{ Params: { coordinationId: string } }>("/group-coordinator/:coordinationId/slots", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      const role = text((request.body as Record<string, unknown>).role) as CoordinationRole;
      if (!["tank", "healer", "damage"].includes(role)) throw new Error("Invalid slot type");
      await addCoordinationRoleSlot({ coordinationId: request.params.coordinationId, actorGuildieId: guildie.guildieId, role });
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { coordinationId: string; opportunityId: string } }>("/group-coordinator/:coordinationId/slots/:opportunityId/remove", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      await removeCoordinationRoleSlot({ coordinationId: request.params.coordinationId, actorGuildieId: guildie.guildieId, opportunityId: request.params.opportunityId });
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
      const minimum = integer(body.minimum);
      if (!allCapabilityTags().includes(tag)) throw new Error("Unknown Group Coordinator capability");
      if (minimum === null || minimum <= 0) throw new Error("Minimum must be a positive integer");
      await addGoal({ coordinationId: request.params.coordinationId, actorGuildieId: guildie.guildieId, tag, minimum });
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { coordinationId: string; goalId: string } }>("/group-coordinator/:coordinationId/goals/:goalId/minimum", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      const minimum = integer((request.body as Record<string, unknown>).minimum);
      if (minimum === null) throw new Error("Minimum must be an integer");
      await updateCoordinationGoalMinimum({ coordinationId: request.params.coordinationId, actorGuildieId: guildie.guildieId, goalId: request.params.goalId, minimum });
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { coordinationId: string; goalId: string } }>("/group-coordinator/:coordinationId/goals/:goalId/remove", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      await removeCoordinationGoal({ coordinationId: request.params.coordinationId, actorGuildieId: guildie.guildieId, goalId: request.params.goalId });
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
      await submitOffer({
        coordinationId: request.params.coordinationId,
        applicantId: applicant.applicantId,
        characterRecordId: text(body.characterRecordId) || null,
        className: text(body.className) || null,
        specName: text(body.specName) || null,
      });
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { coordinationId: string } }>("/group-coordinator/:coordinationId/assign", async (request, reply) => {
    try {
      const guildie = await requireGuildie(request);
      const body = request.body as Record<string, unknown>;
      const opportunityId = text(body.opportunityId);
      const active = await listActiveCoordinationOpportunities(request.params.coordinationId);
      if (!active.some((opportunity) => opportunity.opportunityId === opportunityId)) throw new Error("Slot is no longer active");
      await assignOffer({ coordinationId: request.params.coordinationId, actorGuildieId: guildie.guildieId, offerId: text(body.offerId), opportunityId });
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
