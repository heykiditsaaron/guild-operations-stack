import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME, authenticatedGuildie } from "../../auth.js";
import { activityParticipationOffersForGuildie, activityParticipationsForGuildie } from "../../core/activity/registry.js";
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
    const cards = [
      ...participations.map((reference) => `
          <article class="activity-card">
            <div class="activity-card-header">
              <p class="eyebrow">${htmlText(humanize(reference.activityKind))}</p>
              <h2 class="activity-card-title">Participation</h2>
            </div>
            <a class="button-primary" href="${htmlText(reference.destination)}">View activity</a>
          </article>`),
      ...participationOffers.map((reference) => `
          <article class="activity-card">
            <div class="activity-card-header">
              <p class="eyebrow">${htmlText(humanize(reference.activityKind))}</p>
              <h2 class="activity-card-title">Participation offer</h2>
            </div>
            <a class="button-primary" href="${htmlText(reference.destination)}">View activity</a>
          </article>`),
    ];
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
