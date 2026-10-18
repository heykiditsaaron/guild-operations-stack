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
  setDiscordRaidChannel,
  setDiscordRaffleChannel,
} from "../../integrations/discord/configuration.js";
import { cacheDiscordInteractionPublicKey, loadDiscordInteractionPublicKey } from "../../integrations/discord/interaction-key.js";
import { discordBotInstallUrl, verifyDiscordApplication, discordServerRoles, discordServerMember, discordRoleReadiness, discordServerChannels, discordApplicationEmojis, discordApplicationEmojiMarkup, discordChannelMessage, DISCORD_TEXT_CHANNEL, DISCORD_ANNOUNCEMENT_CHANNEL } from "../../integrations/discord/api.js";
import { provisionDiscordPresentationEmojis } from "../../integrations/discord/application-emojis.js";
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
    let raidSection = "<p>Enable Discord and establish the server to select a raid publication channel.</p>";
    if (configuration?.enabled && configuration.discordGuildId) {
      try {
        const channels = (await discordServerChannels(configuration.botToken, configuration.discordGuildId))
          .filter((channel) => channel.type === DISCORD_TEXT_CHANNEL || channel.type === DISCORD_ANNOUNCEMENT_CHANNEL);
        const options = channels.map((channel) => `<option value="${htmlText(channel.id)}"${configuration.raidChannelId === channel.id ? " selected" : ""}>${htmlText(channel.name ?? channel.id)}</option>`).join("");
        raidSection = `<p>Choose where future Raid projections will appear. Selecting a channel does not publish existing raids.</p>
          <form method="post" action="/admin/discord/raids">
            <label class="discord-field"><span>Raid publication channel</span><select name="channel_id"><option value="">Do not publish raids to Discord</option>${options}</select></label>
            <button type="submit" class="button-primary">Save raid destination</button>
          </form>`;
      } catch (error) {
        request.log.warn({ err: error }, "Discord raid channel discovery failed");
        raidSection = "<p>Unable to inspect Discord channels. Check bot authorization.</p>";
      }
    }
    let raffleSection = "<p>Enable Discord and establish the server to select a raffle publication channel.</p>";
    if (configuration?.enabled && configuration.discordGuildId) {
      try {
        const channels = (await discordServerChannels(configuration.botToken, configuration.discordGuildId))
          .filter((channel) => channel.type === DISCORD_TEXT_CHANNEL || channel.type === DISCORD_ANNOUNCEMENT_CHANNEL);
        const options = channels.map((channel) => `<option value="${htmlText(channel.id)}"${configuration.raffleChannelId === channel.id ? " selected" : ""}>${htmlText(channel.name ?? channel.id)}</option>`).join("");
        raffleSection = `<p>Choose where future Raffle projections will appear. Selecting a channel does not publish existing raffles.</p>
          <form method="post" action="/admin/discord/raffles">
            <label class="discord-field"><span>Raffle publication channel</span><select name="channel_id"><option value="">Do not publish raffles to Discord</option>${options}</select></label>
            <button type="submit" class="button-primary">Save raffle destination</button>
          </form>`;
      } catch (error) {
        request.log.warn({ err: error }, "Discord raffle channel discovery failed");
        raffleSection = "<p>Unable to inspect Discord channels. Check bot authorization.</p>";
      }
    }
    let previewSection = "<p>Enable Discord and establish the server to send an emoji preview.</p>";
    if (configuration?.enabled && configuration.discordGuildId && configuration.applicationVerifiedAt) {
      try {
        const channels = (await discordServerChannels(configuration.botToken, configuration.discordGuildId))
          .filter((channel) => channel.type === DISCORD_TEXT_CHANNEL || channel.type === DISCORD_ANNOUNCEMENT_CHANNEL);
        previewSection = channels.length
          ? `<p>Send one sample raid-style message to a selected channel. This does not configure ongoing publication.</p>
             <form method="post" action="/admin/discord/emoji/preview">
               <label class="discord-field"><span>Preview destination</span>
                 <select name="channel_id" required><option value="">Choose a Discord channel</option>
                   ${channels.map((channel) => `<option value="${htmlText(channel.id)}">${htmlText(channel.name ?? channel.id)}</option>`).join("")}
                 </select></label>
               <button type="submit" class="button-secondary">Send emoji preview</button>
             </form>`
          : "<p>No text channels are available for a preview.</p>";
      } catch (error) {
        request.log.warn({ err: error }, "Discord preview channel discovery failed");
        previewSection = "<p>Unable to inspect Discord channels for the preview.</p>";
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
              <li><strong>Discord interactions.</strong> Raid signup and withdrawal buttons use the existing Discord bot connection automatically. No Interactions Endpoint URL is required. In the Discord Developer Portal under <strong>General Information</strong>, leave the <strong>Interactions Endpoint URL</strong> empty so Discord delivers interactions through the Gateway.
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
      <section class="admin-section"><h2>Raid publication</h2><div class="settings-panel">${raidSection}</div></section>
      <section class="admin-section"><h2>Raffle publication</h2><div class="settings-panel">${raffleSection}</div></section>
      <section class="admin-section"><h2>Application emojis</h2><div class="settings-panel">\n        ${((request.query as { emoji?: string }).emoji === "success") ? '<p role="status">Discord presentation icons successfully provisioned or reused.</p>' : ((request.query as { emoji?: string }).emoji === "failed") ? '<p role="alert">Discord icon setup was incomplete. Check Operations → Logs for details and retry.</p>' : ""}
        <p>Set up raid role and WoW specialization icons for your Discord application in one operation. Existing icons are reused; unrelated emojis are not changed.</p>
        ${configuration?.applicationVerifiedAt ? `<form method="post" action="/admin/discord/emoji/raid-roles"><button type="submit" class="button-secondary">Set up Discord icons</button></form>` : "<p>Verify the Discord application first.</p>"}
      </div></section>
      <section class="admin-section"><h2>Emoji rendering preview</h2><div class="settings-panel">
        ${((request.query as { preview?: string }).preview === "success") ? '<p role="status">Discord emoji preview sent to the selected channel.</p>' : ((request.query as { preview?: string }).preview === "failed") ? '<p role="alert">Unable to send the emoji preview. Check Operations → Logs.</p>' : ""}
        ${previewSection}
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
      const result = await provisionDiscordPresentationEmojis({
        assets, botToken: configuration.botToken, applicationId: configuration.applicationId,
      });
      const complete = result.unavailable.length === 0;
      await publishOperationalRecord({
        source: "discord.application-emoji", operation: "presentation-emoji-setup",
        kind: "result", result: complete ? "success" : "partial",
        actorIdentityId: identity.identityId,
        summary: complete ? "Discord presentation emojis ready" : "Discord presentation emoji setup partially completed",
        details: { applicationId: configuration.applicationId, created: result.created, reused: result.reused, unavailable: result.unavailable, emojis: result.emojis.map(({ id, name }) => ({ id, name })) },
      });
      request.log.info({ created: result.created, reused: result.reused, unavailable: result.unavailable }, "Discord presentation emoji setup finished");
      return reply.code(303).redirect(complete ? "/admin/discord?emoji=success" : "/admin/discord?emoji=failed");
    } catch (error) {
      await publishOperationalRecord({
        source: "discord.application-emoji", operation: "presentation-emoji-setup", kind: "exception",
        actorIdentityId: identity.identityId,
        summary: "Discord presentation emoji setup failed",
        details: { applicationId: configuration.applicationId, error: error instanceof Error ? error.message : String(error) },
      }).catch((recordError) => request.log.error({ err: recordError }, "Unable to record Discord emoji provisioning failure"));
      request.log.error({ err: error }, "Discord role emoji provisioning failed");
      return reply.code(303).redirect("/admin/discord?emoji=failed");
    }
  });

  app.post("/admin/discord/emoji/preview", async (request, reply) => {
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) return reply.code(401).send({ error: "authentication_required" });
    if (!await identityHasGuildCapability(identity.identityId, DISCORD_CONFIGURE_CAPABILITY)) {
      return reply.code(403).send({ error: "discord_configuration_not_authorized" });
    }
    const configuration = await discordIntegrationConfiguration();
    if (!configuration?.enabled || !configuration.applicationVerifiedAt || !configuration.discordGuildId) {
      return reply.code(409).send({ error: "discord_integration_not_ready" });
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    const channelId = body.channel_id;
    if (typeof channelId !== "string" || !/^\d+$/.test(channelId)) {
      return reply.code(400).send({ error: "invalid_discord_preview_channel" });
    }
    const channels = await discordServerChannels(configuration.botToken, configuration.discordGuildId);
    if (!channels.some((channel) => channel.id === channelId &&
      (channel.type === DISCORD_TEXT_CHANNEL || channel.type === DISCORD_ANNOUNCEMENT_CHANNEL))) {
      return reply.code(400).send({ error: "invalid_discord_preview_channel" });
    }
    try {
      const available = new Map((await discordApplicationEmojis(configuration.botToken, configuration.applicationId))
        .map((emoji) => [emoji.name, emoji]));
      const icon = (name: string): string => {
        const emoji = available.get(name);
        return emoji ? discordApplicationEmojiMarkup(emoji) : "[icon unavailable]";
      };
      const payload = {
        allowed_mentions: { parse: [] },
        embeds: [{
          title: "Guild Operations · Raid icon preview",
          description: [
            "Sample presentation only — no raid or signup was created.",
            "",
            `${icon("go_raid_tank")} **Tank** · ${icon("go_spec_warrior_protection")} Protection Warrior`,
            `${icon("go_raid_healer")} **Healer** · ${icon("go_spec_priest_holy")} Holy Priest`,
            `${icon("go_raid_damage")} **Damage** · ${icon("go_spec_mage_fire")} Fire Mage`,
            `${icon("go_raid_damage")} **Damage** · ${icon("go_spec_druid_balance")} Balance Druid`,
          ].join("\n"),
          footer: { text: "Guild Operations · Discord emoji experiment" },
        }],
      };
      const message = await discordChannelMessage(configuration.botToken, channelId, payload);
      await publishOperationalRecord({
        source: "discord.application-emoji", operation: "presentation-preview",
        kind: "result", result: "success", actorIdentityId: identity.identityId,
        summary: "Discord emoji preview sent",
        details: { applicationId: configuration.applicationId, channelId, messageId: message.id },
      });
      return reply.code(303).redirect("/admin/discord?preview=success");
    } catch (error) {
      await publishOperationalRecord({
        source: "discord.application-emoji", operation: "presentation-preview",
        kind: "exception", actorIdentityId: identity.identityId,
        summary: "Discord emoji preview failed",
        details: { applicationId: configuration.applicationId, channelId,
          error: error instanceof Error ? error.message : String(error) },
      }).catch((recordError) => request.log.error({ err: recordError }, "Unable to record Discord preview failure"));
      request.log.error({ err: error }, "Discord emoji preview failed");
      return reply.code(303).redirect("/admin/discord?preview=failed");
    }
  });

  app.post("/admin/discord/raids", async (request, reply) => {
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) return reply.code(401).send({ error: "authentication_required" });
    if (!await identityHasGuildCapability(identity.identityId, DISCORD_CONFIGURE_CAPABILITY)) {
      return reply.code(403).send({ error: "discord_configuration_not_authorized" });
    }
    const configuration = await discordIntegrationConfiguration();
    if (!configuration?.enabled || !configuration.discordGuildId) return reply.code(409).send({ error: "discord_integration_not_ready" });
    const body = (request.body ?? {}) as Record<string, unknown>;
    if (typeof body.channel_id !== "string") return reply.code(400).send({ error: "invalid_discord_raid_channel" });
    const channels = await discordServerChannels(configuration.botToken, configuration.discordGuildId);
    if (body.channel_id && !channels.some((channel) => channel.id === body.channel_id &&
      (channel.type === DISCORD_TEXT_CHANNEL || channel.type === DISCORD_ANNOUNCEMENT_CHANNEL))) {
      return reply.code(422).send({ error: "discord_raid_channel_unavailable" });
    }
    await setDiscordRaidChannel(body.channel_id || null);
    return reply.redirect("/admin/discord");
  });

  app.post("/admin/discord/raffles", async (request, reply) => {
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) return reply.code(401).send({ error: "authentication_required" });
    if (!await identityHasGuildCapability(identity.identityId, DISCORD_CONFIGURE_CAPABILITY)) {
      return reply.code(403).send({ error: "discord_configuration_not_authorized" });
    }
    const configuration = await discordIntegrationConfiguration();
    if (!configuration?.enabled || !configuration.discordGuildId) return reply.code(409).send({ error: "discord_integration_not_ready" });
    const body = (request.body ?? {}) as Record<string, unknown>;
    if (typeof body.channel_id !== "string") return reply.code(400).send({ error: "invalid_discord_raffle_channel" });
    const channels = await discordServerChannels(configuration.botToken, configuration.discordGuildId);
    if (body.channel_id && !channels.some((channel) => channel.id === body.channel_id &&
      (channel.type === DISCORD_TEXT_CHANNEL || channel.type === DISCORD_ANNOUNCEMENT_CHANNEL))) {
      return reply.code(422).send({ error: "discord_raffle_channel_unavailable" });
    }
    await setDiscordRaffleChannel(body.channel_id || null);
    return reply.redirect("/admin/discord");
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
    await loadDiscordInteractionPublicKey();
    const stored = await discordIntegrationConfiguration();
    if (!stored) return reply.code(500).send({ error: "discord_configuration_not_stored" });
    try {
      const application = await verifyDiscordApplication(stored);
      await markDiscordApplicationEstablished(application.name, application.bot?.id ?? null, application.bot?.username ?? null, application.verify_key ?? "");
      cacheDiscordInteractionPublicKey(application.verify_key ?? null);
    } catch (error) {
      request.log.warn({ err: error }, "Discord application verification failed");
      return reply.redirect("/admin/discord?verification=failed");
    }
    return reply.redirect("/admin/discord?verification=success");
  });
}
