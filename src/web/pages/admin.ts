import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import {
  GUILD_REFRESH_CAPABILITY,
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
  content: string,
): string {
  return `<section class="admin-section" aria-labelledby="${headingId}">
    <h2 id="${headingId}">${heading}</h2>
    ${content}
  </section>`;
}

export async function registerAdminPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/admin", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
    ]);
    const [canRefreshGuild, canInspectOperations, canAdministerRaffle] = guildie
      ? await Promise.all([
          guildieHasGuildCapability(guildie.guildieId, GUILD_REFRESH_CAPABILITY),
          guildieHasGuildCapability(guildie.guildieId, OPERATIONS_INSPECT_CAPABILITY),
          raffleGuildieCanAdminister(guildie.guildieId),
        ])
      : [false, false, false];

    const availableAdministration: string[] = [];

    if (canAdministerRaffle) {
      availableAdministration.push(destination(
        "Raffle",
        "Create and operate guild raffles.",
        "/admin/raffle",
      ));
    }

    const hasAdministration = canRefreshGuild || canInspectOperations || availableAdministration.length > 0;
    const guildSettings = canRefreshGuild
      ? administrationSection(
          "guild-settings-heading",
          "Guild settings",
          '<div class="admin-section-content" aria-hidden="true"></div>',
        )
      : "";
    const modules = availableAdministration.length
      ? administrationSection(
          "available-administration-heading",
          "Available administration",
          `<div class="admin-destinations">${availableAdministration.join("\n")}</div>`,
        )
      : "";

    const body = hasAdministration
      ? `<div class="admin-sections">
          ${guildSettings}
          ${modules}
        </div>`
      : `<section class="admin-unavailable" aria-labelledby="admin-unavailable-heading">
          <h2 id="admin-unavailable-heading">Administration is not available for this account.</h2>
        </section>`;

    const logUtility = canInspectOperations
      ? '<a class="admin-header-utility" href="/admin/operations">View logs</a>'
      : "";

    const html = renderPage(assets, {
      pathname: "/admin",
      title: "Administration · OH CRIT I Pulled! Guild Operations",
      description: "Guild Operations administration.",
      viewer,
      stylesheets: ["admin.css"],
      header: `
        <div class="admin-page-header-row">
          <div class="admin-page-header">
            <h1 id="page-title">Administration</h1>
            <p class="lede">Operate and configure the guild.</p>
          </div>
          ${logUtility}
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
