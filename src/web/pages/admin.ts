import type { FastifyInstance } from "fastify";
import { authenticatedSubject, SESSION_COOKIE_NAME } from "../../auth.js";
import { RAFFLE_ADMIN_CAPABILITY, subjectHasGuildCapability } from "../../guild-permissions.js";
import type { AssetRegistry } from "../assets.js";
import { renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

export async function registerAdminPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/admin", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, subject] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedSubject(sessionToken),
    ]);
    const canAdministerRaffle = subject
      ? await subjectHasGuildCapability(subject.subjectId, RAFFLE_ADMIN_CAPABILITY)
      : false;

    const body = canAdministerRaffle
      ? `<section class="admin-destinations" aria-labelledby="admin-destinations-heading">
          <h2 id="admin-destinations-heading">Available administration</h2>
          <a class="admin-destination" href="/admin/raffle">
            <span class="admin-destination-title">Raffle</span>
            <span class="admin-destination-description">Create and operate guild raffles.</span>
            <span class="admin-destination-arrow" aria-hidden="true">→</span>
          </a>
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

    if (!canAdministerRaffle) {
      return reply
        .code(subject ? 403 : 401)
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
