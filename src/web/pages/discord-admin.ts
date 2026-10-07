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
          <div class="discord-setup-guide"><h3>Set up your Discord application</h3><p>Guild Operations uses a Discord application owned by your guild. Discord creates a bot user for a new application, so you do not need to build one yourself.</p><ol><li><strong>Create the application.</strong> Open the <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">Discord Developer Portal</a>, choose <strong>New Application</strong>, and give it a name. On <strong>General Information</strong>, copy the <strong>Application ID</strong> below.</li><li><strong>Add the OAuth redirect.</strong> In the application’s <strong>OAuth2</strong> settings, add this exact redirect URI:<br><code>${htmlText(callbackUrl)}</code></li><li><strong>Get the client secret.</strong> In <strong>OAuth2</strong>, copy or reset the <strong>Client Secret</strong> and enter it below.</li><li><strong>Get the bot token.</strong> Open <strong>Bot</strong> in the sidebar and reset/copy the bot <strong>Token</strong>. Treat it like a password and enter it only into your own Guild Operations installation.</li><li><strong>Verify the application.</strong> Guild Operations will verify that the bot token belongs to the Application ID before considering the application established.</li></ol><p><a class="button-secondary" href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">Open Discord Developer Portal</a></p></div>
          ${installUrl && !configuration?.discordGuildId ? `<div><h3>Install in your Discord server</h3><p>Choose the Discord server this Guild Operations deployment should use. After installation, Guild Operations will verify the bot relationship before binding the server.</p><p><a class="button-primary" href="${htmlText(installUrl)}" target="_blank" rel="noreferrer">Install in Discord Server</a></p></div>` : ""}
          <form method="post" action="/admin/discord">
            <label><span>Application ID</span><input name="application_id" value="${htmlText(configuration?.applicationId ?? "")}" required></label>
            <label><span>Client secret</span><input type="password" name="client_secret" autocomplete="new-password"${configuration ? "" : " required"}><small>${configuration ? "Leave blank to keep the stored secret." : "Required for initial setup."}</small></label>
            <label><span>Bot token</span><input type="password" name="bot_token" autocomplete="new-password"${configuration ? "" : " required"}><small>${configuration ? "Leave blank to keep the stored token." : "Required for initial setup."}</small></label>
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
