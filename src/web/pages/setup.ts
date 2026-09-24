import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME, authenticatedGuildie } from "../../auth.js";
import { installationGuildBinding } from "../../core/installation/guild-binding.js";
import { discoverInstallationGuildCandidates } from "../../core/installation/guild-candidates.js";
import type { AssetRegistry } from "../assets.js";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function document(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Set up Guild Operations</title></head><body><main><h1>Set up Guild Operations</h1>${body}</main></body></html>`;
}

export async function registerSetupPage(app: FastifyInstance, _assets: AssetRegistry): Promise<void> {
  app.get("/setup", async (request, reply) => {
    const binding = await installationGuildBinding();
    if (binding?.authorizedAt) return reply.redirect("/");

    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) {
      return reply.type("text/html; charset=utf-8").send(document(
        '<p>Connect your Blizzard account to identify the guild this installation will serve.</p><p><a href="/auth/blizzard/start?return_to=%2Fsetup">Continue with Blizzard</a></p>',
      ));
    }

    if (!binding) {
      const candidates = await discoverInstallationGuildCandidates(guildie.guildieId);
      const choices = candidates.map((candidate) => `
        <form method="post" action="/installation/guild">
          <input type="hidden" name="region" value="${escapeHtml(candidate.region)}">
          <input type="hidden" name="guild_id" value="${escapeHtml(candidate.guildId)}">
          <button type="submit">${escapeHtml(candidate.name)} — ${escapeHtml(candidate.realmName ?? candidate.realmSlug)}</button>
        </form>`).join("");
      return reply.type("text/html; charset=utf-8").send(document(
        `<p>Select the guild this installation will serve.</p>${choices || "<p>No current guilds were found for your controlled characters.</p>"}`,
      ));
    }

    return reply.type("text/html; charset=utf-8").send(document(
      '<p>The guild has been identified. A current Guild Master must authorize this installation before it can operate.</p><form method="post" action="/installation/authorize"><button type="submit">Authorize Guild Operations</button></form>',
    ));
  });
}
