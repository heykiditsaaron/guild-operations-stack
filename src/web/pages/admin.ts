import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import {
  OPERATIONS_INSPECT_CAPABILITY,
  guildieHasGuildCapability,
} from "../../guild-permissions.js";
import { raffleGuildieCanAdminister } from "../../modules/raffle/authorization.js";
import type { AssetRegistry } from "../assets.js";
import { renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

export async function registerAdminPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/admin", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
    ]);
    const [canInspectOperations, canAdministerRaffle] = guildie
      ? await Promise.all([
          guildieHasGuildCapability(guildie.guildieId, OPERATIONS_INSPECT_CAPABILITY),
          raffleGuildieCanAdminister(guildie.guildieId),
        ])
      : [false, false];

    const destinations: string[] = [];

    if (canInspectOperations) {
      destinations.push(`<a class="admin-destination" href="/admin/operations">
        <span class="admin-destination-title">Operations</span>
        <span class="admin-destination-description">Review operational results and exceptions.</span>
        <span class="admin-destination-arrow" aria-hidden="true">→</span>
      </a>`);
    }

    if (canAdministerRaffle) {
      destinations.push(`<a class="admin-destination" href="/admin/raffle">
        <span class="admin-destination-title">Raffle</span>
        <span class="admin-destination-description">Create and operate guild raffles.</span>
        <span class="admin-destination-arrow" aria-hidden="true">→</span>
      </a>`);
    }

    const hasAdministration = destinations.length > 0;
    const body = hasAdministration
      ? `<section class="admin-destinations" aria-labelledby="admin-destinations-heading">
          <h2 id="admin-destinations-heading">Available administration</h2>
          ${destinations.join("\n")}
        </section>`
      : `<section class="admin-unavailable" aria-labelledby="admin-unavailable-heading">
          <h2 id="admin-unavailable-heading">Administration is not available for this account.</h2>
        </section>`;

    const html = renderPage(assets, {
      pathname: "/admin",
      title: "Administration · OH CRIT I Pulled! Guild Operations",
      description: "Guild Operations administration.",
      viewer,
      stylesheets: ["admin.css"],
      header: `
        <div class="admin-page-header">
          <p class="eyebrow">Guild Operations</p>
          <h1 id="page-title">Administration</h1>
          <p class="lede">Operate the guild systems available to you.</p>
        </div>`,
      body,
    });

    if (!hasAdministration) {
      return reply
        .code(guildie ? 403 : 401)
        .header("Cache-Control", "no-cache")
        .type("text/html; charset=utf-8")
        .send(html);
    }

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
