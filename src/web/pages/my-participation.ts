import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME, authenticatedGuildie } from "../../auth.js";
import { activityParticipationForGuildie } from "../../core/activity/registry.js";
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

    const participation = await activityParticipationForGuildie(guildie.guildieId);
    const body = participation.length
      ? `<div class="activity-card-list">${participation.map((reference) => `
          <article class="activity-card">
            <div class="activity-card-header">
              <p class="eyebrow">${htmlText(humanize(reference.activityKind))}</p>
              <h2 class="activity-card-title">Participation</h2>
            </div>
            <a class="button-primary" href="${htmlText(reference.destination)}">View activity</a>
          </article>`).join("\n")}</div>`
      : `<section><h2>No participation yet</h2><p>Activities you take part in will appear here.</p><a class="button-primary" href="/events">Find activities</a></section>`;

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(renderPage(assets, {
        pathname: "/me/participation",
        title: `My Participation · ${viewer.guildPresentation.guildName} Guild Operations`,
        description: "Activities you participate in.",
        viewer,
        secondaryNavigation: { kind: "back", label: "Home", href: "/" },
        header: `<div><p class="eyebrow">Me</p><h1 id="page-title">My Participation</h1><p class="lede">The guild activities you have taken part in.</p></div>`,
        body,
      }));
  });
}
