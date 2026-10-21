import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME, authenticatedIdentity } from "../../auth.js";
import { installationGuildBinding } from "../../core/installation/guild-binding.js";
import { discoverInstallationGuildCandidates } from "../../core/installation/guild-candidates.js";
import { assetUrl, type AssetRegistry } from "../assets.js";
import { installationBlizzardConfigured } from "../../core/installation/blizzard-configuration.js";
import { publicOriginForRequest } from "../../core/installation/public-origin.js";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderSetupDocument(assets: AssetRegistry, body: string): string {
  const restart = `<aside class="setup-restart"><p>Need to start over?</p><button class="button-secondary setup-restart-action" type="button" data-setup-restart>Restart setup</button></aside>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Set up Guild Operations</title><link rel="stylesheet" href="${assetUrl(assets, "app.css")}"><link rel="stylesheet" href="${assetUrl(assets, "setup.css")}"></head><body><main class="setup-shell"><section class="setup-card"><p class="eyebrow">First run</p><h1>Set up Guild Operations</h1>${body}${restart}</section></main><script src="${assetUrl(assets, "setup.js")}" defer></script></body></html>`;
}

export function renderAccountSelectionDocument(assets: AssetRegistry, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Choose your WoW account · Guild Operations</title><link rel="stylesheet" href="${assetUrl(assets, "app.css")}"><link rel="stylesheet" href="${assetUrl(assets, "setup.css")}"></head><body><main class="setup-shell account-selection-shell"><section class="setup-card account-selection-card"><p class="eyebrow">Blizzard sign in</p><h1>Choose your WoW account</h1><p class="account-selection-intro">Select the World of Warcraft account you want to use with Guild Operations.</p>${body}</section></main></body></html>`;
}

export async function registerSetupPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/setup", async (request, reply) => {
    const blizzardConfigured = await installationBlizzardConfigured();
    if (!blizzardConfigured) {
      const callbackUrl = new URL("/auth/blizzard/callback", publicOriginForRequest(request)).toString();
      return reply.type("text/html; charset=utf-8").send(renderSetupDocument(
        assets,
        `<p>Connect Guild Operations to a Blizzard application before identifying the guild this installation will serve.</p>
        <p>Create a Blizzard application, then register this callback URL.</p>
        <p>Retrieve the setup authorization token from the host with <code>docker compose exec api cat /var/lib/guild-operations/setup-authorization.token</code>. Keep it private.</p>
        <p><a class="button-secondary setup-external-action" href="https://develop.battle.net/access/clients" target="_blank" rel="noopener noreferrer">Open Blizzard Developer Portal ↗</a></p>
        <div class="setup-copy-value">
          <code>${escapeHtml(callbackUrl)}</code>
          <button class="setup-copy-action" type="button" data-copy-value="${escapeHtml(callbackUrl)}" aria-label="Copy callback URL" title="Copy callback URL">
            <svg class="setup-copy-icon setup-copy-icon-copy" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"></path></svg>
            <svg class="setup-copy-icon setup-copy-icon-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>
          </button>
        </div>
        <form method="post" data-setup-blizzard>
          <label>Setup authorization token<input name="setup_token" type="password" autocomplete="off" required></label>
          <label>Client ID<input name="client_id" autocomplete="off" required></label>
          <label>Client Secret<input name="client_secret" type="password" autocomplete="new-password" required></label>
          <button class="button-primary setup-action" type="submit">Connect Blizzard</button>
        </form>
        <p class="setup-status" data-setup-status aria-live="polite"></p>`,
      ));
    }

    const binding = await installationGuildBinding();
    if (binding?.authorizedAt) return reply.redirect("/");

    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) {
      return reply.type("text/html; charset=utf-8").send(renderSetupDocument(
        assets,
        '<p>Connect your Blizzard account to identify the guild this installation will serve.</p><p><a class="button-primary setup-action" href="/auth/blizzard/start?return_to=%2Fsetup">Continue with Blizzard</a></p>',
      ));
    }

    if (!binding) {
      const candidates = await discoverInstallationGuildCandidates(identity.identityId);
      const choices = candidates.map((candidate) => `
        <form method="post" data-setup-guild>
          <input type="hidden" name="region" value="${escapeHtml(candidate.region)}">
          <input type="hidden" name="guild_id" value="${escapeHtml(candidate.guildId)}">
          <button class="button-primary setup-action" type="submit">${escapeHtml(candidate.name)} — ${escapeHtml(candidate.realmName ?? candidate.realmSlug)}</button>
        </form>`).join("");
      return reply.type("text/html; charset=utf-8").send(renderSetupDocument(
        assets,
        `<p>Select the guild this installation will serve.</p>${choices || "<p>No current guilds were found for your controlled characters.</p>"}<p class="setup-status" data-setup-status aria-live="polite"></p>`,
      ));
    }

    return reply.type("text/html; charset=utf-8").send(renderSetupDocument(
      assets,
      '<p>The guild has been identified. A current Guild Master must authorize this installation before it can operate.</p><form method="post" data-setup-authorize><button class="button-primary setup-action" type="submit">Authorize Guild Operations</button></form><p>If you are not the Guild Master, sign out and have them continue setup with their Blizzard account.</p><form method="post" data-setup-signout><button class="button-secondary setup-action" type="submit">Sign out for Guild Master</button></form><p class="setup-status" data-setup-status aria-live="polite"></p>',
    ));
  });
}
