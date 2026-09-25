import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../auth.js";
import { activityRegistrationState } from "../../core/activity/registry.js";
import { knownActivityPlugin } from "../../core/activity/plugin-control.js";
import type { AssetRegistry } from "../assets.js";
import { htmlText, renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

export async function registerActivityBoundaryRoutes(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get<{ Params: { kind: string; "*": string } }>("/activities/:kind/*", async (request, reply) => {
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
  });
}
