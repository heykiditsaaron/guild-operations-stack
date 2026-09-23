import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { guildieHasGuildCapability } from "../../core/authority/guild-permissions.js";
import type { AssetRegistry } from "../../web/assets.js";
import { renderPage } from "../../web/render.js";
import { viewerForRequest } from "../../web/viewer.js";
import { DISCORD_ADMIN_CAPABILITY } from "./authorization.js";
import {
  discordGuildIntegrationConfigured,
  getDiscordGuildChannels,
  type DiscordGuildChannel,
} from "./client.js";
import {
  configureDiscordRaidProjection,
  discordRaidProjectionConfiguration,
} from "./raid-projection.js";

function htmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function channelOptions(channels: readonly DiscordGuildChannel[], selected: string | null): string {
  const available = channels.filter((channel) => channel.type === 0 || channel.type === 5);
  return [
    '<option value="">Not configured</option>',
    ...available.map((channel) =>
      `<option value="${htmlText(channel.id)}"${channel.id === selected ? " selected" : ""}>#${htmlText(channel.name)}</option>`
    ),
  ].join("");
}

export async function registerDiscordRaidAdminPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/admin/plugins/discord/raid", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
    ]);
    if (!guildie) return reply.code(401).send("Authentication is required.");
    if (!await guildieHasGuildCapability(guildie.guildieId, DISCORD_ADMIN_CAPABILITY)) {
      return reply.code(403).send("Discord administration is not available for this account.");
    }

    const configuration = await discordRaidProjectionConfiguration();
    const configured = await discordGuildIntegrationConfigured();
    let channels: DiscordGuildChannel[] = [];
    let acquisitionFailed = false;
    if (configured) {
      try {
        channels = await getDiscordGuildChannels();
      } catch (error) {
        request.log.error({ err: error }, "Discord Raid channel acquisition failed");
        acquisitionFailed = true;
      }
    }

    const unavailable = !configured
      ? '<p class="admin-unavailable">Configure and enable the Discord plugin before selecting a Raid destination.</p>'
      : acquisitionFailed
        ? '<p class="admin-unavailable">Discord channels could not be loaded. Check runtime logs and try again.</p>'
        : "";

    const body = `<div class="admin-sections">
      <section class="admin-section" aria-labelledby="discord-raid-heading">
        <h2 id="discord-raid-heading">Raid projection</h2>
        ${unavailable}
        <form class="settings-panel" method="post" action="/admin/plugins/discord/raid">
          <div>
            <h3>Destination</h3>
            <p>New Raid projections are created in this Discord channel. Existing Raid messages remain in the channel where they were created.</p>
          </div>
          <div class="theme-settings-controls">
            <label><span>Discord channel</span><select name="channelId"${configured && !acquisitionFailed ? "" : " disabled"}>${channelOptions(channels, configuration.channelId)}</select></label>
            <button type="submit" class="button-primary"${configured && !acquisitionFailed ? "" : " disabled"}>Save</button>
          </div>
        </form>
      </section>
    </div>`;

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(renderPage(assets, {
        pathname: "/admin/plugins/discord/raid",
        title: `Raid Discord projection · ${viewer.guildPresentation.guildName} Guild Operations`,
        description: "Configure Raid projection into Discord.",
        viewer,
        stylesheets: ["admin.css"],
        secondaryNavigation: {
          kind: "breadcrumb",
          items: [
            { label: "Settings", href: "/admin/modules" },
            { label: "Plugins", href: "/admin/modules" },
            { label: "Discord", href: "/admin/plugins/discord" },
            { label: "Raid" },
          ],
        },
        header: '<div class="admin-page-header"><h1 id="page-title">Raid × Discord</h1><p class="lede">Configure how Raid occurrences are projected into Discord.</p></div>',
        body,
      }));
  });

  app.post("/admin/plugins/discord/raid", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send("Authentication is required.");
    if (!await guildieHasGuildCapability(guildie.guildieId, DISCORD_ADMIN_CAPABILITY)) {
      return reply.code(403).send("Discord administration is not available for this account.");
    }

    const body = request.body as Record<string, unknown>;
    const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
    if (channelId) {
      if (!await discordGuildIntegrationConfigured()) return reply.code(503).send("Discord is not configured.");
      const channels = await getDiscordGuildChannels();
      if (!channels.some((channel) => channel.id === channelId && (channel.type === 0 || channel.type === 5))) {
        return reply.code(400).send("The selected Discord channel is not available.");
      }
    }

    await configureDiscordRaidProjection(channelId || null);
    return reply.redirect("/admin/plugins/discord/raid");
  });
}
