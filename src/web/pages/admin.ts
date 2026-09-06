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

function destination(title: string, description: string, href: string): string {
  return `<a class="admin-destination" href="${href}">
    <span class="admin-destination-title">${title}</span>
    <span class="admin-destination-description">${description}</span>
    <span class="admin-destination-arrow" aria-hidden="true">→</span>
  </a>`;
}

function administrationSection(
  headingId: string,
  heading: string,
  destinations: string[],
): string {
  if (!destinations.length) return "";

  return `<section class="admin-section" aria-labelledby="${headingId}">
    <h2 id="${headingId}">${heading}</h2>
    <div class="admin-destinations">
      ${destinations.join("\n")}
    </div>
  </section>`;
}

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

    const globalAdministration: string[] = [];
    const availableAdministration: string[] = [];

    if (canInspectOperations) {
      globalAdministration.push(destination(
        "Operational logging",
        "Review operational results and exceptions.",
        "/admin/operations",
      ));
    }

    if (canAdministerRaffle) {
      availableAdministration.push(destination(
        "Raffle",
        "Create and operate guild raffles.",
        "/admin/raffle",
      ));
    }

    const hasAdministration = globalAdministration.length > 0 || availableAdministration.length > 0;
    const body = hasAdministration
      ? `<div class="admin-sections">
          ${administrationSection(
            "global-administration-heading",
            "Global administration",
            globalAdministration,
          )}
          ${administrationSection(
            "available-administration-heading",
            "Available administration",
            availableAdministration,
          )}
        </div>`
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
