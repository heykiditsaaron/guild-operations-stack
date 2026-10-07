import type { FastifyInstance } from "fastify";
import { authenticatedIdentity, SESSION_COOKIE_NAME } from "../../auth.js";
import { DISCORD_CONFIGURE_CAPABILITY, identityHasGuildCapability } from "../../core/authority/guild-permissions.js";
import { installationAbsoluteUrl } from "../../core/installation/public-origin.js";
import {
  discordIntegrationConfiguration,
  markDiscordApplicationEstablished,
  replaceDiscordApplicationCredentials,
  setDiscordIntegrationEnabled,
} from "../../integrations/discord/configuration.js";
import { discordBotInstallUrl, verifyDiscordApplication } from "../../integrations/discord/api.js";
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

    const installUrl = configuration?.applicationVerifiedAt ? discordBotInstallUrl(configuration.applicationId) : null;
    const body = `<div class="admin-sections">
      <section class="admin-section" aria-labelledby="discord-heading">
        <h2 id="discord-heading">Discord Integration</h2>
        <div class="settings-panel">
          <div><h3>Status</h3><p><strong>${htmlText(readiness)}</strong></p>${configuration?.applicationVerifiedAt ? `<p>Application: ${htmlText(configuration.applicationName ?? configuration.applicationId)}${configuration.botUsername ? ` · Bot: ${htmlText(configuration.botUsername)}` : ""}</p>` : ""}<p>Discord remains authoritative for Discord application and server authorization. Guild Operations stores only the relationship and credentials needed to operate the Integration.</p></div>
          <form class="discord-setup-guide discord-credential-form" method="post" action="/admin/discord">
            <h3>Set up your Discord application</h3>
            <p>Guild Operations uses a Discord application owned by your guild. Discord creates its bot user automatically.</p>
            <ol class="discord-setup-steps">
              <li><strong>Create the application.</strong> Open the <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">Discord Developer Portal</a>, select <strong>New Application</strong>, and name it. Find the Application ID under <strong>General Information</strong>.
                <label class="discord-field"><span>Application ID</span><input name="application_id" value="${htmlText(configuration?.applicationId ?? "")}" required></label>
              </li>
              <li><strong>Configure OAuth.</strong> Under <strong>OAuth2</strong>, register this exact redirect URI:
                <div class="discord-callback"><code>${htmlText(callbackUrl)}</code><button type="button" class="button-secondary" data-copy-discord-callback>Copy</button></div>
                Then copy or reset the Client Secret.
                <label class="discord-field"><span>Client secret</span><input type="password" name="client_secret" autocomplete="new-password"${configuration ? "" : " required"}><small>${configuration ? "Leave blank to retain the stored secret." : "Required for initial setup."}</small></label>
              </li>
              <li><strong>Configure the bot.</strong> Open <strong>Bot</strong> in the Developer Portal and copy or reset the bot Token. Treat it as a password.
                <label class="discord-field"><span>Bot token</span><input type="password" name="bot_token" autocomplete="new-password"${configuration ? "" : " required"}><small>${configuration ? "Leave blank to retain the stored token." : "Required for initial setup."}</small></label>
              </li>
              <li><strong>Verify the application.</strong> Guild Operations checks that the bot token belongs to the specified application.
                <button type="submit" class="button-primary discord-verify-action">Save and verify Discord application</button>
              </li>
            </ol>
            <div class="discord-enablement-row">
              <div><strong>Discord Integration</strong><p>Enable Discord once you want Guild Operations to operate the connection. Setup and verification can be completed while disabled.</p></div>
              <label class="switch discord-enablement"><input type="checkbox" name="enabled" value="true"${configuration?.enabled ? " checked" : ""}><span class="switch-control" aria-hidden="true"></span><span>${configuration?.enabled ? "On" : "Off"}</span></label>
            </div>
          </form>
          ${installUrl && !configuration?.discordGuildId ? `<div class="discord-server-install"><h3>Install in your Discord server</h3><p>Choose the server for this deployment. Guild Operations verifies the bot relationship before binding the server.</p><a class="button-primary" href="${htmlText(installUrl)}" target="_blank" rel="noreferrer">Install in Discord Server</a></div>` : ""}
        </div>
      </section>
    </div>`;

    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(renderPage(assets, {
      pathname: "/admin/discord",
      title: `Discord Settings · ${viewer.guildPresentation.guildName} Guild Operations`,
      description: "Configure the Discord Integration.",
      viewer,
      stylesheets: ["admin.css", "discord-admin.css"],
      header: '<div class="admin-page-header"><h1 id="page-title">Discord</h1><p class="lede">Connect Guild Operations to this guild’s Discord application and server.</p></div>',
      body,
      scripts: ["discord-admin.js"],
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
    await replaceDiscordApplicationCredentials({
      applicationId: body.application_id,
      clientSecret: body.client_secret,
      botToken: body.bot_token,
    });
    await setDiscordIntegrationEnabled(body.enabled === "true");
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
