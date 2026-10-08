import type { FastifyInstance } from "fastify";
import { authenticatedIdentity, SESSION_COOKIE_NAME } from "../../auth.js";
import { DISCORD_CONFIGURE_CAPABILITY, identityHasGuildCapability } from "../../core/authority/guild-permissions.js";
import { installationAbsoluteUrl } from "../../core/installation/public-origin.js";
import {
  discordIntegrationConfiguration,
  markDiscordApplicationEstablished,
  replaceDiscordApplicationCredentials,
  setDiscordIntegrationEnabled,
  setDiscordArticleChannel,
} from "../../integrations/discord/configuration.js";
import { discordBotInstallUrl, verifyDiscordApplication, discordServerRoles, discordServerMember, discordRoleReadiness, discordServerChannels, DISCORD_TEXT_CHANNEL, DISCORD_ANNOUNCEMENT_CHANNEL } from "../../integrations/discord/api.js";
import { provisionRaidRoleEmoji } from "../../integrations/discord/role-emoji.js";
import { publishOperationalRecord } from "../../operational-inspection.js";
import { discordRankRoleMappings, replaceDiscordRankRoleMappings } from "../../integrations/discord/role-mappings.js";
import { guildRankDefinitions } from "../../core/guild/guild-ranks.js";
import { requireOperationalInstallationGuildBinding } from "../../core/installation/guild-binding.js";
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
    const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
    const [guildRanks, mappings] = await Promise.all([guildRankDefinitions(guildId), discordRankRoleMappings(guildId)]);
    let roleSection = "<p>Enable Discord and establish the server to configure role synchronization.</p>";
    if (configuration?.enabled && configuration.discordGuildId && configuration.botUserId) {
      try {
        const [roles, botMember] = await Promise.all([
          discordServerRoles(configuration.botToken, configuration.discordGuildId),
          discordServerMember(configuration.botToken, configuration.discordGuildId, configuration.botUserId),
        ]);
        if (botMember) {
          const roleReadiness = discordRoleReadiness({
            roles, botRoleIds: botMember.roles, botUserId: configuration.botUserId,
            guildId: configuration.discordGuildId, mappedRoleIds: mappings.map((mapping) => mapping.discordRoleId),
          });
          const options = roles.filter((role) => role.id !== configuration.discordGuildId && !role.managed);
          const fields = guildRanks.map((rank) => {
            const selected = mappings.find((mapping) => mapping.rankIndex === rank.rankIndex)?.discordRoleId ?? "";
            return `<label class="discord-field"><span>${htmlText(rank.displayName)}</span>
              <select name="rank_${rank.rankIndex}"><option value="">No role</option>
              ${options.map((role) => `<option value="${htmlText(role.id)}"${selected === role.id ? " selected" : ""}>${htmlText(role.name)}</option>`).join("")}
              </select></label>`;
          }).join("");
          roleSection = `<p>${mappings.length === 0 ? "No rank roles configured." : roleReadiness.ready ? "Configured role mappings are manageable." : "Role synchronization needs attention."}</p>
            ${roleReadiness.reasons.map((reason) => `<p>${htmlText(reason)}</p>`).join("")}
            <form method="post" action="/admin/discord/roles">
              <p>Choose an optional Discord role for each effective guild rank.</p>
              ${fields}<button class="button-primary" type="submit">Save role mappings</button>
            </form>`;
        } else {
          roleSection = "<p>The bot is not in the bound Discord server.</p>";
        }
      } catch (error) {
        request.log.warn({ err: error }, "Discord role discovery failed");
        roleSection = "<p>Unable to inspect Discord roles. Check bot authorization.</p>";
      }
    }
    let articleSection = "<p>Enable Discord and establish the server to select an article publication channel.</p>";
    if (configuration?.enabled && configuration.discordGuildId) {
      try {
        const channels = (await discordServerChannels(configuration.botToken, configuration.discordGuildId))
          .filter((channel) => channel.type === DISCORD_TEXT_CHANNEL || channel.type === DISCORD_ANNOUNCEMENT_CHANNEL);
        const options = channels.map((channel) => `<option value="${htmlText(channel.id)}"${configuration.articleChannelId === channel.id ? " selected" : ""}>${htmlText(channel.name ?? channel.id)}</option>`).join("");
        articleSection = `<p>Publish Guild Operations articles to an optional Discord channel. Articles remain authoritative in Guild Operations.</p>
          <form method="post" action="/admin/discord/articles">
            <label class="discord-field"><span>Article publication channel</span><select name="channel_id"><option value="">Do not publish articles to Discord</option>${options}</select></label>
            <button type="submit" class="button-primary">Save article destination</button>
          </form>`;
      } catch (error) {
        request.log.warn({ err: error }, "Discord channel discovery failed");
        articleSection = "<p>Unable to inspect Discord channels. Check bot authorization.</p>";
      }
    }
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
      <section class="admin-section"><h2>Article publication</h2><div class="settings-panel">${articleSection}</div></section>
      <section class="admin-section"><h2>Application emoji experiment</h2><div class="settings-panel">\n        ${((request.query as { emoji?: string }).emoji === "success") ? '<p role="status">Raid role icons successfully provisioned or reused in your Discord application.</p>' : ((request.query as { emoji?: string }).emoji === "failed") ? '<p role="alert">Unable to provision raid role icons. Check application credentials and server logs, then retry.</p>' : ""}
        <p>Provision the existing raid role artwork to your Discord application. Existing emojis with these names are reused; unrelated emojis are not changed.</p>
        ${configuration?.applicationVerifiedAt ? `<form method="post" action="/admin/discord/emoji/raid-roles"><button type="submit" class="button-secondary">Provision raid role icons</button></form>` : "<p>Verify the Discord application first.</p>"}
      </div></section>
      <section class="admin-section"><h2>Rank role mapping</h2><div class="settings-panel">${roleSection}</div></section>

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

  app.post("/admin/discord/emoji/raid-roles", async (request, reply) => {
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) return reply.code(401).send({ error: "authentication_required" });
    if (!await identityHasGuildCapability(identity.identityId, DISCORD_CONFIGURE_CAPABILITY)) {
      return reply.code(403).send({ error: "discord_configuration_not_authorized" });
    }
    const configuration = await discordIntegrationConfiguration();
    if (!configuration?.applicationVerifiedAt) return reply.code(409).send({ error: "discord_application_not_verified" });
    try {
      const emojis = [];
      for (const role of ["tank", "healer", "damage"] as const) {
        emojis.push(await provisionRaidRoleEmoji({
          assets, botToken: configuration.botToken, applicationId: configuration.applicationId, role,
        }));
      }
      await publishOperationalRecord({
        source: "discord.application-emoji", operation: "raid-role-provisioning", kind: "result", result: "success",
        actorIdentityId: identity.identityId,
        summary: "Discord raid role emojis provisioned or reused",
        details: { applicationId: configuration.applicationId, emojis: emojis.map(({ id, name }) => ({ id, name })) },
      });
      request.log.info({ applicationId: configuration.applicationId, emojis: emojis.map(({ id, name }) => ({ id, name })) }, "Discord role emoji provisioning succeeded");
      return reply.code(303).redirect("/admin/discord?emoji=success");
    } catch (error) {
      await publishOperationalRecord({
        source: "discord.application-emoji", operation: "raid-role-provisioning", kind: "exception",
        actorIdentityId: identity.identityId,
        summary: "Discord raid role emoji provisioning failed",
        details: { applicationId: configuration.applicationId, error: error instanceof Error ? error.message : String(error) },
      }).catch((recordError) => request.log.error({ err: recordError }, "Unable to record Discord emoji provisioning failure"));
      request.log.error({ err: error }, "Discord role emoji provisioning failed");
      return reply.code(303).redirect("/admin/discord?emoji=failed");
    }
  });

  app.post("/admin/discord/articles", async (request, reply) => {
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) return reply.code(401).send({ error: "authentication_required" });
    if (!await identityHasGuildCapability(identity.identityId, DISCORD_CONFIGURE_CAPABILITY)) {
      return reply.code(403).send({ error: "discord_configuration_not_authorized" });
    }
    const configuration = await discordIntegrationConfiguration();
    if (!configuration?.enabled || !configuration.discordGuildId) return reply.code(409).send({ error: "discord_integration_not_ready" });
    const body = (request.body ?? {}) as Record<string, unknown>;
    if (typeof body.channel_id !== "string") return reply.code(400).send({ error: "invalid_discord_article_channel" });
    const channels = await discordServerChannels(configuration.botToken, configuration.discordGuildId);
    const valid = channels.some((channel) => channel.id === body.channel_id && (channel.type === DISCORD_TEXT_CHANNEL || channel.type === DISCORD_ANNOUNCEMENT_CHANNEL));
    if (body.channel_id && !valid) return reply.code(422).send({ error: "discord_article_channel_unavailable" });
    await setDiscordArticleChannel(body.channel_id || null);
    return reply.redirect("/admin/discord");
  });

  app.post("/admin/discord/roles", async (request, reply) => {
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) return reply.code(401).send({ error: "authentication_required" });
    if (!await identityHasGuildCapability(identity.identityId, DISCORD_CONFIGURE_CAPABILITY)) {
      return reply.code(403).send({ error: "discord_configuration_not_authorized" });
    }
    const configuration = await discordIntegrationConfiguration();
    if (!configuration?.enabled || !configuration.discordGuildId || !configuration.botUserId) {
      return reply.code(409).send({ error: "discord_integration_not_ready" });
    }
    const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
    const [ranks, roles, botMember] = await Promise.all([
      guildRankDefinitions(guildId),
      discordServerRoles(configuration.botToken, configuration.discordGuildId),
      discordServerMember(configuration.botToken, configuration.discordGuildId, configuration.botUserId),
    ]);
    if (!botMember) return reply.code(409).send({ error: "discord_bot_not_in_server" });
    const body = (request.body ?? {}) as Record<string, unknown>;
    const mappings = ranks.flatMap((rank) => {
      const value = body[`rank_${rank.rankIndex}`];
      return typeof value === "string" && value ? [{ rankIndex: rank.rankIndex, discordRoleId: value }] : [];
    });
    const readiness = discordRoleReadiness({
      roles, botRoleIds: botMember.roles, botUserId: configuration.botUserId,
      guildId: configuration.discordGuildId, mappedRoleIds: mappings.map((mapping) => mapping.discordRoleId),
    });
    if (!readiness.ready && mappings.length > 0) {
      return reply.code(422).send({ error: "discord_role_mapping_not_manageable", reasons: readiness.reasons });
    }
    try {
      await replaceDiscordRankRoleMappings({ guildId, discordGuildId: configuration.discordGuildId, mappings });
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_discord_rank_role_mapping") {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
    return reply.redirect("/admin/discord");
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
