import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { activityKindRenderActions, activityOccurrence, activityOccurrenceRenderActions, activityOccurrences, activityRegistrationState, activityWorkspace, type ActivityOccurrenceAttribute } from "../../core/activity/registry.js";
import { knownActivityPlugin } from "../../core/activity/plugin-control.js";
import type { AssetRegistry } from "../assets.js";
import { htmlText, renderPage, renderPublicOccurrence } from "../render.js";
import { renderActivityOccurrenceSharedValues } from "../activity-values.js";
import { renderActivityWorkspace } from "../activity-workspace.js";
import { viewerForRequest } from "../viewer.js";

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

export async function registerActivityBoundaryRoutes(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get<{ Params: { kind: string; activityId: string } }>("/activities/:kind/:activityId", async (request, reply) => {
    const occurrence = await activityOccurrence(request.params.kind, request.params.activityId);
    if (!occurrence) return reply.callNotFound();

    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
    ]);
    const [fingerprint, actions, workspace] = await Promise.all([
      knownActivityPlugin(occurrence.activityKind),
      activityOccurrenceRenderActions(occurrence, guildie?.guildieId ?? null),
      occurrence.phase === "active" ? activityWorkspace(occurrence.activityKind, occurrence.activityId) : Promise.resolve(null),
    ]);
    const label = fingerprint?.label ?? occurrence.activityKind;
    const time = occurrenceTime(occurrence.occursAt);
    const renderedAttributes = await Promise.all(occurrence.attributes.map(async (attribute) =>
      `<div class="fact" data-activity-attribute="${htmlText(attribute.kind)}" data-provenance="${attribute.provenance}"><span class="fact-label">${htmlText(attribute.label)}</span><strong class="fact-value">${await renderActivityOccurrenceSharedValues(occurrence, attribute.value)}</strong></div>`
    ));
    const facts = [
      ...(time === null ? [] : [`<div class="fact"><span class="fact-label">When</span><strong class="fact-value">${time}</strong></div>`]),
      ...renderedAttributes,
    ].join("");
    const workspaceHtml = workspace ? await renderActivityWorkspace(occurrence, workspace) : "";

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
          detail: workspaceHtml,
        }),
      }));
  });

  app.get<{ Params: { kind: string } }>("/activities/:kind", async (request, reply) => {
    const state = await activityRegistrationState(request.params.kind);
    if (!state?.active) return reply.callNotFound();

    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie, fingerprint, occurrences] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
      knownActivityPlugin(request.params.kind),
      activityOccurrences(request.params.kind),
    ]);
    const label = fingerprint?.label ?? request.params.kind;
    const kindActions = await activityKindRenderActions(request.params.kind, guildie?.guildieId ?? null);
    const cards = await Promise.all(occurrences.map(async (occurrence) => {
      const actions = await activityOccurrenceRenderActions(occurrence, guildie?.guildieId ?? null);
      const time = occurrenceTime(occurrence.occursAt);
      const renderedAttributes = await Promise.all(occurrence.attributes.map(async (attribute) =>
        `<div class="fact" data-activity-attribute="${htmlText(attribute.kind)}" data-provenance="${attribute.provenance}"><span class="fact-label">${htmlText(attribute.label)}</span><strong class="fact-value">${await renderActivityOccurrenceSharedValues(occurrence, attribute.value)}</strong></div>`
      ));
      const facts = [
        ...(time === null ? [] : [`<div class="fact"><span class="fact-label">When</span><strong class="fact-value">${time}</strong></div>`]),
        ...renderedAttributes,
      ].join("");
      const actionLinks = actions.map((action) => `<a class="button-${action.kind}" href="${htmlText(action.href)}">${htmlText(action.label)}</a>`).join("");
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
      header: `<div class="admin-page-header-row"><div><p class="eyebrow">Activities</p><h1 id="page-title">${htmlText(label)}</h1></div>${kindActions.map((action) => `<a class="button-${action.kind}" href="${htmlText(action.href)}">${htmlText(action.label)}</a>`).join("")}</div>`,
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
