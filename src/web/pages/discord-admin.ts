import type { FastifyInstance } from "fastify";
import { authenticatedIdentity, SESSION_COOKIE_NAME } from "../../auth.js";
import { DISCORD_CONFIGURE_CAPABILITY, identityHasGuildCapability } from "../../core/authority/guild-permissions.js";
import { installationAbsoluteUrl } from "../../core/installation/public-origin.js";
import {
  discordIntegrationConfiguration,
  markDiscordApplicationEstablished,
  storeDiscordIntegrationConfiguration,
} from "../../integrations/discord/configuration.js";
import { verifyDiscordApplication } from "../../integrations/discord/api.js";
import type { AssetRegistry } from "../assets.js";
import { htmlText, renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

export async function registerDiscordAdminPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  if (!app.hasContentTypeParser("application/x-www-form-urlencoded")) {
    app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
      const params = new URLSearchParams(typeof body === "string" ? body : body.toString("utf8"));
      done(null, Object.fromEntries(params.entries()));
    });
  }

  app.get("/admin/discord", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    const [identity, viewer] = await Promise.all([authenticatedIdentity(token), viewerForRequest(token)]);
    if (!identity) return reply.code(401).send("Authentication is required.");
    if (!await identityHasGuildCapability(identity.identityId, DISCORD_CONFIGURE_CAPABILITY)) {
      return reply.code(403).send("Discord configuration is not available for this account.");
    }

    const [configuration, callbackUrl] = await Promise.all([
      discordIntegrationConfiguration(),
      installationAbsoluteUrl("/integrations/discord/oauth/callback"),
    ]);
    const readiness = !configuration
      ? "Not configured"
      : !configuration.applicationVerifiedAt
        ? "Setup required · application not verified"
        : configuration.discordGuildId
        ? configuration.enabled ? "Enabled · server established" : "Configured · disabled"
        : configuration.enabled ? "Enabled · server not established" : "Configured · disabled";

    const body = `<div class="admin-sections">
      <section class="admin-section" aria-labelledby="discord-heading">
        <h2 id="discord-heading">Discord Integration</h2>
        <div class="settings-panel">
          <div><h3>Status</h3><p><strong>${htmlText(readiness)}</strong></p>${configuration?.applicationVerifiedAt ? `<p>Application: ${htmlText(configuration.applicationName ?? configuration.applicationId)}${configuration.botUsername ? ` · Bot: ${htmlText(configuration.botUsername)}` : ""}</p>` : ""}<p>Discord remains authoritative for Discord application and server authorization. Guild Operations stores only the relationship and credentials needed to operate the Integration.</p></div>
          <div><h3>OAuth callback</h3><p>Configure this redirect URI in the Discord Developer Portal.</p><code>${htmlText(callbackUrl)}</code></div>
          <form method="post" action="/admin/discord">
            <label><span>Application ID</span><input name="application_id" value="${htmlText(configuration?.applicationId ?? "")}" required></label>
            <label><span>Client secret</span><input type="password" name="client_secret" autocomplete="new-password" required></label>
            <label><span>Bot token</span><input type="password" name="bot_token" autocomplete="new-password" required></label>
            <label><input type="checkbox" name="enabled" value="true"${configuration?.enabled ? " checked" : ""}> <span>Enable Discord Integration</span></label>
            <button type="submit" class="button-primary">Save and verify Discord application</button>
          </form>
        </div>
      </section>
    </div>`;

    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(renderPage(assets, {
      pathname: "/admin/discord",
      title: `Discord Settings · ${viewer.guildPresentation.guildName} Guild Operations`,
      description: "Configure the Discord Integration.",
      viewer,
      stylesheets: ["admin.css"],
      header: '<div class="admin-page-header"><h1 id="page-title">Discord</h1><p class="lede">Connect Guild Operations to this guild’s Discord application and server.</p></div>',
      body,
    }));
  });

  app.post("/admin/discord", async (request, reply) => {
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) return reply.code(401).send({ error: "authentication_required" });
    if (!await identityHasGuildCapability(identity.identityId, DISCORD_CONFIGURE_CAPABILITY)) {
      return reply.code(403).send({ error: "discord_configuration_not_authorized" });
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    if (typeof body.application_id !== "string" || typeof body.client_secret !== "string" || typeof body.bot_token !== "string") {
      return reply.code(400).send({ error: "invalid_discord_configuration" });
    }
    const existing = await discordIntegrationConfiguration();
    await storeDiscordIntegrationConfiguration({
      enabled: body.enabled === "true",
      applicationId: body.application_id,
      clientSecret: body.client_secret,
      botToken: body.bot_token,
      discordGuildId: existing?.discordGuildId ?? null,
    });
    const stored = await discordIntegrationConfiguration();
    if (!stored) return reply.code(500).send({ error: "discord_configuration_not_stored" });
    try {
      const application = await verifyDiscordApplication(stored);
      await markDiscordApplicationEstablished(application.name, application.bot?.id ?? null, application.bot?.username ?? null);
    } catch (error) {
      request.log.warn({ err: error }, "Discord application verification failed");
      return reply.redirect("/admin/discord?verification=failed");
    }
    return reply.redirect("/admin/discord?verification=success");
  });
}
