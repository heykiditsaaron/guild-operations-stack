import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME, authenticatedGuildie } from "../../auth.js";
import { activityOccurrence, activityParticipationOffersForGuildie, activityParticipationProjection, activityParticipationsForGuildie } from "../../core/activity/registry.js";
import type { AssetRegistry } from "../assets.js";
import { htmlText, renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

function humanize(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function projectionFacts(projection: Awaited<ReturnType<typeof activityParticipationProjection>>): string {
  if (!projection) return "";
  return `<div class="facts">${projection.attributes.map((attribute) => {
    const value = attribute.value.kind === "quantity"
      ? `${attribute.value.value} ${attribute.value.unit}`
      : String(attribute.value.value);
    return `<div class="fact"><span class="fact-label">${htmlText(attribute.label)}</span><strong class="fact-value">${htmlText(value)}</strong></div>`;
  }).join("")}</div>`;
}

export async function registerMyParticipationPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/me/participation", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [guildie, viewer] = await Promise.all([
      authenticatedGuildie(sessionToken),
      viewerForRequest(sessionToken),
    ]);
    if (!guildie || !viewer.authenticated) return reply.redirect("/auth/blizzard/start?return_to=%2Fme%2Fparticipation");

    const [participations, participationOffers] = await Promise.all([
      activityParticipationsForGuildie(guildie.guildieId),
      activityParticipationOffersForGuildie(guildie.guildieId),
    ]);
    const cards = await Promise.all([
      ...participations.map(async (reference) => {
        const [occurrence, projection] = await Promise.all([
          activityOccurrence(reference.activityKind, reference.activityId),
          activityParticipationProjection(reference.activityKind, reference.activityId, reference.procedureReference),
        ]);
        return `
          <article class="activity-card">
            <div class="activity-card-header">
              <p class="eyebrow">${htmlText(humanize(reference.activityKind))} · Participation</p>
              <h2 class="activity-card-title">${htmlText(occurrence?.title ?? "Activity")}</h2>
              ${projection ? `<p>${htmlText(projection.title)}</p>` : ""}
            </div>
            ${projectionFacts(projection)}
            <a class="button-primary" href="${htmlText(reference.destination)}">View activity</a>
          </article>`;
      }),
      ...participationOffers.map(async (reference) => {
        const [occurrence, projection] = await Promise.all([
          activityOccurrence(reference.activityKind, reference.activityId),
          activityParticipationProjection(reference.activityKind, reference.activityId, reference.procedureReference),
        ]);
        return `
          <article class="activity-card">
            <div class="activity-card-header">
              <p class="eyebrow">${htmlText(humanize(reference.activityKind))} · Participation offer</p>
              <h2 class="activity-card-title">${htmlText(occurrence?.title ?? "Activity")}</h2>
              ${projection ? `<p>${htmlText(projection.title)}</p>` : ""}
            </div>
            ${projectionFacts(projection)}
            <a class="button-primary" href="${htmlText(reference.destination)}">View activity</a>
          </article>`;
      }),
    ]);
    const body = cards.length
      ? `<div class="activity-card-list">${cards.join("\n")}</div>`
      : `<section><h2>No participation yet</h2><p>Your Activity Participation and outstanding offers will appear here.</p><a class="button-primary" href="/activities">Find activities</a></section>`;

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(renderPage(assets, {
        pathname: "/me/participation",
        title: `My Participation · ${viewer.guildPresentation.guildName} Guild Operations`,
        description: "Your Activity Participation and outstanding participation offers.",
        viewer,
        secondaryNavigation: { kind: "back", label: "Home", href: "/" },
        header: `<div><p class="eyebrow">Me</p><h1 id="page-title">My Participation</h1><p class="lede">Your Participation and outstanding offers across guild activities.</p></div>`,
        body,
      }));
  });
}
