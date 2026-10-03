import type { FastifyInstance } from "fastify";
import { authenticatedIdentity, SESSION_COOKIE_NAME } from "../../auth.js";
import { activityAssignments, activityKindRenderActions, activityOccurrence, activityOccurrenceRenderActions, activityOccurrences, activityRegistrationState, type ActivityAssignment, type ActivityOccurrence, type ActivityOccurrenceAttribute, type ActivityRenderAction, type ActivitySharedValue } from "../../core/activity/registry.js";
import { knownActivityPlugin } from "../../core/activity/plugin-control.js";
import type { AssetRegistry } from "../assets.js";
import { htmlText, renderPage, renderPublicOccurrence } from "../render.js";
import { renderActivityOccurrenceSharedValues } from "../activity-values.js";
import { viewerForRequest } from "../viewer.js";
import { positionForSpec } from "../../wow-traits/registry.js";

function localTime(unixSeconds: number): string {
  const instant = new Date(unixSeconds * 1000).toISOString();
  return `<time datetime="${instant}" data-local-time-unix="${unixSeconds}" data-local-time-date-style="full">${instant}</time>`;
}

function occurrenceTime(occursAt: { start: number | null; end: number | null } | null): string | null {
  if (occursAt === null) return null;
  if (occursAt.start !== null && occursAt.end !== null) {
    return occursAt.start === occursAt.end
      ? localTime(occursAt.start)
      : `${localTime(occursAt.start)}<span aria-hidden="true"> → </span>${localTime(occursAt.end)}`;
  }
  return localTime(occursAt.start ?? occursAt.end!);
}


function scalarAttribute(occurrence: ActivityOccurrence, kind: string): ActivitySharedValue | null {
  const value = occurrence.attributes.find((attribute) => attribute.kind === kind)?.value;
  if (!value || Array.isArray(value)) return null;
  return value as ActivitySharedValue;
}

function integerAttribute(occurrence: ActivityOccurrence, kind: string): number {
  const value = scalarAttribute(occurrence, kind);
  return value?.type === "integer" ? value.value : 0;
}

function stringAttribute(occurrence: ActivityOccurrence, kind: string): string | null {
  const value = scalarAttribute(occurrence, kind);
  return value?.type === "string" ? value.value : null;
}

function raidRoleMetric(label: string, count: number, role: "tank" | "healer" | "damage"): string {
  return `<div class="raid-occurrence-role"><span class="raid-occurrence-role-icon raid-occurrence-role-icon-${role}" aria-hidden="true"></span><span class="raid-occurrence-role-copy"><strong>${count}</strong><span>${label}</span></span></div>`;
}

function assignmentAttribute(assignment: ActivityAssignment, kind: string): ActivitySharedValue | null {
  const value = assignment.attributes.find((attribute) => attribute.kind === kind)?.value;
  if (!value || Array.isArray(value)) return null;
  return value as ActivitySharedValue;
}

function raidAssignmentComposition(assignments: readonly ActivityAssignment[]) {
  let tanks = 0;
  let healers = 0;
  let melee = 0;
  let ranged = 0;

  for (const assignment of assignments) {
    const role = assignmentAttribute(assignment, "assigned_role");
    if (role?.type !== "wow_role") continue;
    if (role.value === "tank") {
      tanks += 1;
      continue;
    }
    if (role.value === "healer") {
      healers += 1;
      continue;
    }

    const spec = assignmentAttribute(assignment, "assigned_spec");
    if (spec?.type !== "wow_spec") continue;
    const position = positionForSpec(spec.value.className, spec.value.specName);
    if (position === "melee") melee += 1;
    if (position === "ranged") ranged += 1;
  }

  return { tanks, healers, melee, ranged };
}

function raidTitleScale(title: string): "short" | "medium" | "long" {
  const length = [...title.trim()].length;
  if (length > 52) return "long";
  if (length > 30) return "medium";
  return "short";
}

async function renderRaidOccurrence(occurrence: ActivityOccurrence, actions: readonly ActivityRenderAction[], assignments: readonly ActivityAssignment[]): Promise<string> {
  const difficulty = stringAttribute(occurrence, "difficulty") ?? "Raid";
  const difficultyClass = difficulty.toLocaleLowerCase("en-US").replace(/[^a-z0-9_-]/g, "-");
  const titleScale = raidTitleScale(occurrence.title);
  const signedUp = integerAttribute(occurrence, "signed_up");
  const composition = raidAssignmentComposition(assignments);
  const requirements = occurrence.attributes.filter((attribute) => attribute.kind === "eligibility" || attribute.kind === "requirement");
  const renderedRequirements = await Promise.all(requirements.map(async (attribute) =>
    `<div class="raid-occurrence-requirement"><span>${htmlText(attribute.label)}</span><strong>${await renderActivityOccurrenceSharedValues(occurrence, attribute.value)}</strong></div>`
  ));
  const actionLinks = actions.map((action) => `<a class="button-${action.kind}" href="${htmlText(action.href)}">${htmlText(action.label)}</a>`).join("");
  const firstPull = occurrence.occursAt?.start === null || occurrence.occursAt?.start === undefined
    ? ""
    : `<section class="raid-occurrence-first-pull" aria-label="Raid time"><span>First pull</span><strong>${localTime(occurrence.occursAt.start)}</strong></section>`;

  return `<article class="public-occurrence raid-occurrence">
    <header class="raid-occurrence-hero">
      <p class="raid-occurrence-kicker raid-difficulty-${htmlText(difficultyClass)}">${htmlText(difficulty.toUpperCase())} RAID</p>
      <h1 class="raid-occurrence-title raid-occurrence-title-${titleScale}">${htmlText(occurrence.title)}</h1>
      ${occurrence.description ? `<div class="raid-occurrence-description"><p>${htmlText(occurrence.description)}</p></div>` : ""}
      ${firstPull}
    </header>
    <section class="raid-occurrence-composition" aria-labelledby="raid-composition-heading">
      <div class="raid-occurrence-section-heading"><div><p class="eyebrow">Raid group</p><h2 id="raid-composition-heading">Who's in so far</h2></div><p class="raid-occurrence-signups"><strong>${signedUp}</strong> signed up</p></div>
      <div class="raid-occurrence-role-grid">
        ${raidRoleMetric("Tank", composition.tanks, "tank")}
        ${raidRoleMetric("Healer", composition.healers, "healer")}
        ${raidRoleMetric("Melee", composition.melee, "damage")}
        ${raidRoleMetric("Ranged", composition.ranged, "damage")}
      </div>
    </section>
    ${renderedRequirements.length ? `<section class="raid-occurrence-requirements" aria-labelledby="raid-details-heading"><div class="raid-occurrence-section-heading"><div><p class="eyebrow">Before you sign up</p><h2 id="raid-details-heading">Raid details</h2></div></div><div class="raid-occurrence-requirement-grid">${renderedRequirements.join("")}</div></section>` : ""}
    ${actionLinks ? `<nav class="public-occurrence-actions raid-occurrence-actions" aria-label="Raid actions">${actionLinks}</nav>` : ""}
  </article>`;
}

function raffleConclusionLabel(conclusion: string | null): string {
  if (conclusion === "drawn") return "Drawn";
  if (conclusion === "operator_cancelled") return "Cancelled";
  return "Active";
}

async function renderRaffleOccurrence(occurrence: ActivityOccurrence, actions: readonly ActivityRenderAction[]): Promise<string> {
  const entryPrice = scalarAttribute(occurrence, "entry_price");
  const entries = integerAttribute(occurrence, "approved_entries");
  const prize = scalarAttribute(occurrence, "prize");
  const currentPrize = scalarAttribute(occurrence, "current_prize");
  const conclusion = stringAttribute(occurrence, "conclusion");
  const winner = scalarAttribute(occurrence, "winner");
  const drawingAt = occurrence.occursAt?.end ?? null;
  const actionLinks = actions.map((action) => `<a class="button-${action.kind}" href="${htmlText(action.href)}">${htmlText(action.label)}</a>`).join("");

  const prizeValue = currentPrize ?? prize;
  const renderedPrize = prizeValue ? await renderActivityOccurrenceSharedValues(occurrence, prizeValue) : "Prize to be announced";
  const renderedEntryPrice = entryPrice ? await renderActivityOccurrenceSharedValues(occurrence, entryPrice) : "—";
  const renderedWinner = winner ? await renderActivityOccurrenceSharedValues(occurrence, winner) : null;

  return `<article class="public-occurrence raffle-occurrence">
    <header class="raffle-occurrence-hero">
      <div class="raffle-occurrence-heading">
        <p class="raffle-occurrence-kicker">${occurrence.phase === "record" ? "Raffle record" : "Guild raffle"}</p>
        <h1>${htmlText(occurrence.title)}</h1>
        ${occurrence.description ? `<p class="raffle-occurrence-description">${htmlText(occurrence.description)}</p>` : ""}
      </div>
      <div class="raffle-occurrence-prize" aria-label="Raffle prize">
        <span>${currentPrize ? (occurrence.phase === "record" ? "Prize value" : "Current prize") : "Prize"}</span>
        <strong>${renderedPrize}</strong>
      </div>
    </header>
    <section class="raffle-occurrence-summary" aria-label="Raffle details">
      ${drawingAt === null ? "" : `<div class="raffle-occurrence-draw"><span>${occurrence.phase === "record" ? "Drawing time" : "Draws"}</span><strong>${localTime(drawingAt)}</strong></div>`}
      <div class="raffle-occurrence-metric"><span>Entry price</span><strong>${renderedEntryPrice}</strong></div>
      <div class="raffle-occurrence-metric"><span>Approved entries</span><strong>${entries}</strong></div>
      <div class="raffle-occurrence-metric"><span>Status</span><strong>${raffleConclusionLabel(conclusion)}</strong></div>
    </section>
    ${renderedWinner ? `<section class="raffle-occurrence-winner" aria-label="Raffle winner"><span>Winner</span><strong>${renderedWinner}</strong></section>` : ""}
    ${actionLinks ? `<nav class="public-occurrence-actions raffle-occurrence-actions" aria-label="Raffle actions">${actionLinks}</nav>` : ""}
  </article>`;
}

export async function registerActivityBoundaryRoutes(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get<{ Params: { kind: string; activityId: string } }>("/activities/:kind/:activityId", async (request, reply) => {
    const occurrence = await activityOccurrence(request.params.kind, request.params.activityId);
    if (!occurrence) return reply.callNotFound();

    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, identity] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedIdentity(sessionToken),
    ]);
    const [fingerprint, actions, assignments] = await Promise.all([
      knownActivityPlugin(occurrence.activityKind),
      activityOccurrenceRenderActions(occurrence, identity?.identityId ?? null),
      activityAssignments(occurrence.activityKind, occurrence.activityId),
    ]);
    const label = fingerprint?.label ?? occurrence.activityKind;

    if (occurrence.activityKind === "raid") {
      return reply
        .header("Cache-Control", "no-cache")
        .type("text/html; charset=utf-8")
        .send(renderPage(assets, {
          pathname: request.url,
          title: `${occurrence.title} · ${label} · ${viewer.guildPresentation.guildName} Guild Operations`,
          description: occurrence.description ?? `${label} activity occurrence.`,
          viewer,
          stylesheets: ["wow-role-icons.css"],
          secondaryNavigation: { kind: "breadcrumb", items: [{ label: "Activities", href: "/activities" }, { label }] },
          header: "",
          body: await renderRaidOccurrence(occurrence, actions, assignments),
        }));
    }

    if (occurrence.activityKind === "raffle") {
      return reply
        .header("Cache-Control", "no-cache")
        .type("text/html; charset=utf-8")
        .send(renderPage(assets, {
          pathname: request.url,
          title: `${occurrence.title} · ${label} · ${viewer.guildPresentation.guildName} Guild Operations`,
          description: occurrence.description ?? `${label} activity occurrence.`,
          viewer,
          secondaryNavigation: { kind: "breadcrumb", items: [{ label: "Activities", href: "/activities" }, { label }] },
          header: "",
          body: await renderRaffleOccurrence(occurrence, actions),
        }));
    }

    const time = occurrenceTime(occurrence.occursAt);
    const renderedAttributes = await Promise.all(occurrence.attributes.map(async (attribute) =>
      `<div class="fact" data-activity-attribute="${htmlText(attribute.kind)}" data-provenance="${attribute.provenance}"><span class="fact-label">${htmlText(attribute.label)}</span><strong class="fact-value">${await renderActivityOccurrenceSharedValues(occurrence, attribute.value)}</strong></div>`
    ));
    const facts = [
      ...(time === null ? [] : [`<div class="fact"><span class="fact-label">When</span><strong class="fact-value">${time}</strong></div>`]),
      ...renderedAttributes,
    ].join("");

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(renderPage(assets, {
        pathname: request.url,
        title: `${occurrence.title} · ${label} · ${viewer.guildPresentation.guildName} Guild Operations`,
        description: occurrence.description ?? `${label} activity occurrence.`,
        viewer,
        secondaryNavigation: { kind: "breadcrumb", items: [{ label: "Activities", href: "/activities" }, { label }] },
        header: `<div><p class="eyebrow">Activities · ${htmlText(label)}</p></div>`,
        body: renderPublicOccurrence({
          title: occurrence.title,
          state: occurrence.phase === "active" ? "Active" : "Record",
          active: occurrence.phase === "active",
          description: occurrence.description ? `<p>${htmlText(occurrence.description)}</p>` : undefined,
          facts,
          actions,
        }),
      }));
  });

  app.get<{ Params: { kind: string } }>("/activities/:kind", async (request, reply) => {
    const state = await activityRegistrationState(request.params.kind);
    if (!state?.active) return reply.callNotFound();

    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, identity, fingerprint, occurrences] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedIdentity(sessionToken),
      knownActivityPlugin(request.params.kind),
      activityOccurrences(request.params.kind),
    ]);
    const label = fingerprint?.label ?? request.params.kind;
    const kindActions = await activityKindRenderActions(request.params.kind, identity?.identityId ?? null);
    const cards = await Promise.all(occurrences.map(async (occurrence) => {
      const actions = await activityOccurrenceRenderActions(occurrence, identity?.identityId ?? null);
      const actionLinks = actions.map((action) => `<a class="button-${action.kind}" href="${htmlText(action.href)}">${htmlText(action.label)}</a>`).join("");

      if (occurrence.activityKind === "raffle") {
        const entryPrice = scalarAttribute(occurrence, "entry_price");
        const entries = integerAttribute(occurrence, "approved_entries");
        const prize = scalarAttribute(occurrence, "current_prize") ?? scalarAttribute(occurrence, "prize");
        const drawingAt = occurrence.occursAt?.end ?? null;
        const renderedPrize = prize ? await renderActivityOccurrenceSharedValues(occurrence, prize) : "Prize to be announced";
        const renderedEntryPrice = entryPrice ? await renderActivityOccurrenceSharedValues(occurrence, entryPrice) : "—";
        return `<article class="activity-card raffle-listing-card">
          <div class="raffle-listing-identity">
            <p class="raffle-listing-kicker">${occurrence.phase === "record" ? "Raffle record" : "Guild raffle"}</p>
            <h2 class="activity-card-title"><a href="/activities/${encodeURIComponent(occurrence.activityKind)}/${encodeURIComponent(occurrence.activityId)}">${htmlText(occurrence.title)}</a></h2>
            ${occurrence.description ? `<p class="raffle-listing-description">${htmlText(occurrence.description)}</p>` : ""}
          </div>
          <div class="raffle-listing-prize"><span>${occurrence.phase === "record" ? "Prize" : "Current prize"}</span><strong>${renderedPrize}</strong></div>
          <div class="raffle-listing-summary">
            ${drawingAt === null ? "" : `<div class="raffle-listing-draw"><span>Draws</span><strong>${localTime(drawingAt)}</strong></div>`}
            <div class="raffle-listing-stats"><span><strong>${renderedEntryPrice}</strong> per entry</span><span><strong>${entries}</strong> approved</span></div>
          </div>
          ${actionLinks ? `<nav class="activity-card-actions raffle-listing-actions" aria-label="${htmlText(occurrence.title)} actions">${actionLinks}</nav>` : ""}
        </article>`;
      }

      if (occurrence.activityKind === "raid") {
        const difficulty = stringAttribute(occurrence, "difficulty") ?? "Raid";
        const difficultyClass = difficulty.toLocaleLowerCase("en-US").replace(/[^a-z0-9_-]/g, "-");
        const signedUp = integerAttribute(occurrence, "signed_up");
        const firstPull = occurrence.occursAt?.start === null || occurrence.occursAt?.start === undefined
          ? ""
          : `<div class="raid-listing-time"><span>First pull</span><strong>${localTime(occurrence.occursAt.start)}</strong></div>`;
        return `<article class="activity-card raid-listing-card">
          <div class="raid-listing-identity">
            <span class="raid-listing-difficulty raid-difficulty-${htmlText(difficultyClass)}">${htmlText(difficulty)}</span>
            <h2 class="activity-card-title"><a href="/activities/${encodeURIComponent(occurrence.activityKind)}/${encodeURIComponent(occurrence.activityId)}">${htmlText(occurrence.title)}</a></h2>
            ${occurrence.description ? `<p class="raid-listing-description">${htmlText(occurrence.description)}</p>` : ""}
          </div>
          <div class="raid-listing-summary">
            ${firstPull}
            <p class="raid-listing-signups"><strong>${signedUp}</strong> signed up</p>
          </div>
          ${actionLinks ? `<nav class="activity-card-actions raid-listing-actions" aria-label="${htmlText(occurrence.title)} actions">${actionLinks}</nav>` : ""}
        </article>`;
      }

      const time = occurrenceTime(occurrence.occursAt);
      const renderedAttributes = await Promise.all(occurrence.attributes.map(async (attribute) =>
        `<div class="fact" data-activity-attribute="${htmlText(attribute.kind)}" data-provenance="${attribute.provenance}"><span class="fact-label">${htmlText(attribute.label)}</span><strong class="fact-value">${await renderActivityOccurrenceSharedValues(occurrence, attribute.value)}</strong></div>`
      ));
      const facts = [
        ...(time === null ? [] : [`<div class="fact"><span class="fact-label">When</span><strong class="fact-value">${time}</strong></div>`]),
        ...renderedAttributes,
      ].join("");
      return `<article class="activity-card"><div class="activity-card-header"><h2 class="activity-card-title"><a href="/activities/${encodeURIComponent(occurrence.activityKind)}/${encodeURIComponent(occurrence.activityId)}">${htmlText(occurrence.title)}</a></h2><p class="status${occurrence.phase === "active" ? " status-active" : ""}">${occurrence.phase === "active" ? "Active" : "Record"}</p>${occurrence.description ? `<p>${htmlText(occurrence.description)}</p>` : ""}</div><div class="facts">${facts}</div>${actionLinks ? `<nav class="activity-card-actions" aria-label="${htmlText(occurrence.title)} actions">${actionLinks}</nav>` : ""}</article>`;
    }));
    const body = cards.length
      ? `<div class="activity-card-list">${cards.join("\n")}</div>`
      : `<section><h2>No active ${htmlText(label)} occurrences</h2><p>Occurrences will appear here when they are available.</p></section>`;

    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(renderPage(assets, {
      pathname: request.url,
      title: `${label} · ${viewer.guildPresentation.guildName} Guild Operations`,
      description: `${label} guild activities.`,
      viewer,
      secondaryNavigation: { kind: "breadcrumb", items: [{ label: "Activities", href: "/activities" }, { label }] },
      header: `<div class="activity-kind-header"><div><p class="eyebrow">Activities</p><h1 id="page-title">${htmlText(label)}</h1></div>${kindActions.map((action) => `<a class="button-${action.kind} activity-kind-new" href="${htmlText(action.href)}">+ ${htmlText(action.label.startsWith("Create ") ? `New ${action.label.slice(7)}` : action.label)}</a>`).join("")}</div>`,
      body,
    }));
  });

  const unavailable = async (request: any, reply: any) => {
    const kind = request.params.kind;
    const state = await activityRegistrationState(kind);
    if (!state) return reply.callNotFound();
    if (state.active) return reply.callNotFound();

    const fingerprint = await knownActivityPlugin(kind);
    const label = fingerprint?.label ?? kind;
    const viewer = await viewerForRequest(request.cookies[SESSION_COOKIE_NAME]);

    return reply
      .code(503)
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(renderPage(assets, {
        pathname: request.url,
        title: `${label} unavailable · ${viewer.guildPresentation.guildName} Guild Operations`,
        description: `${label} is currently unavailable.`,
        viewer,
        secondaryNavigation: { kind: "back", label: "Activities", href: "/activities" },
        header: `<div><p class="eyebrow">Guild activity</p><h1 id="page-title">${htmlText(label)}</h1><p class="lede">This activity is currently unavailable.</p></div>`,
        body: `<section><h2>Activity unavailable</h2><p>${htmlText(label)} is known to Guild Operations, but it is not currently active.</p><a class="button-primary" href="/activities">Back to activities</a></section>`,
      }));
  };

  app.get<{ Params: { kind: string; "*": string } }>("/activities/:kind/*", unavailable);
}
