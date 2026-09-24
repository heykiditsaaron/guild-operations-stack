import type { FastifyInstance } from "fastify";
import { discoverableActivities } from "../../core/activity/registry.js";
import type { AssetRegistry } from "../assets.js";
import { htmlText, renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";
import { SESSION_COOKIE_NAME } from "../../auth.js";

export async function registerActivitiesPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/activities", async (request, reply) => {
    const viewer = await viewerForRequest(request.cookies[SESSION_COOKIE_NAME]);
    const activities = discoverableActivities();
    const body = activities.length
      ? `<div class="activity-card-list">${activities.map((activity) => `
          <a class="activity-card" href="${htmlText(activity.destination)}">
            <p class="eyebrow">Guild activity</p>
            <h2>${htmlText(activity.title)}</h2>
            <p>${htmlText(activity.tagline)}</p>
            <span>Explore activity <span aria-hidden="true">→</span></span>
          </a>`).join("\n")}</div>`
      : `<section><h2>No activities available</h2><p>Guild activities will appear here when they are available.</p></section>`;

    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(renderPage(assets, {
      pathname: "/activities",
      title: `Activities · ${viewer.guildPresentation.guildName} Guild Operations`,
      description: `Discover ways to participate in ${viewer.guildPresentation.guildName}.`,
      viewer,
      header: `<div><p class="eyebrow">Guild participation</p><h1 id="page-title">Activities</h1><p class="lede">Explore what the guild does and how you can take part.</p></div>`,
      body,
    }));
  });
}
