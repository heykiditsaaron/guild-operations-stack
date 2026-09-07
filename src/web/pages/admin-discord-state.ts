import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { config } from "../../config.js";
import { pool } from "../../db.js";
import {
  GUILD_DISCORD_MANAGE_CAPABILITY,
  guildieHasGuildCapability,
} from "../../guild-permissions.js";
import { discordGuildIntegrationConfigured } from "../../guildie-discord/client.js";
import { guildDiscordProjectionSettings } from "../../guildie-discord/policy.js";
import { discordStateForGuildie } from "../../guildie-discord/state.js";
import type { AssetRegistry } from "../assets.js";
import { renderPage, type SecondaryNavigation } from "../render.js";
import { viewerForRequest } from "../viewer.js";

function htmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type AssociatedGuildie = {
  guildie_id: string;
  discord_user_id: string;
  discord_username: string;
  main_name: string | null;
  main_realm_name: string | null;
};

type UnavailableStatusCode = 401 | 403 | 503;

const discordStateNavigation: SecondaryNavigation = {
  kind: "back",
  label: "Administration",
  href: "/admin",
};

function renderUnavailable(
  assets: AssetRegistry,
  viewer: Awaited<ReturnType<typeof viewerForRequest>>,
  statusCode: UnavailableStatusCode,
  message: string,
): { statusCode: UnavailableStatusCode; html: string } {
  return {
    statusCode,
    html: renderPage(assets, {
      pathname: "/admin/discord-state",
      title: "Discord state · OH CRIT I Pulled! Guild Operations",
      description: "Discord state inspection.",
      viewer,
      secondaryNavigation: discordStateNavigation,
      stylesheets: ["admin.css"],
      scripts: ["admin.js"],
      header: `<div class="admin-page-header"><h1 id="page-title">Discord state</h1></div>`,
      body: `<section class="admin-unavailable"><p>${htmlText(message)}</p></section>`,
    }),
  };
}

export async function registerAdminDiscordStatePage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/admin/discord-state", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
    ]);

    if (!guildie) {
      const unavailable = renderUnavailable(assets, viewer, 401, "Authentication is required.");
      return reply
        .code(unavailable.statusCode)
        .header("Cache-Control", "no-cache")
        .type("text/html; charset=utf-8")
        .send(unavailable.html);
    }

    if (!await guildieHasGuildCapability(guildie.guildieId, GUILD_DISCORD_MANAGE_CAPABILITY)) {
      const unavailable = renderUnavailable(
        assets,
        viewer,
        403,
        "Discord administration is not available for this account.",
      );
      return reply
        .code(unavailable.statusCode)
        .header("Cache-Control", "no-cache")
        .type("text/html; charset=utf-8")
        .send(unavailable.html);
    }

    if (!discordGuildIntegrationConfigured()) {
      const unavailable = renderUnavailable(
        assets,
        viewer,
        503,
        "Direct Discord guild integration is not configured.",
      );
      return reply
        .code(unavailable.statusCode)
        .header("Cache-Control", "no-cache")
        .type("text/html; charset=utf-8")
        .send(unavailable.html);
    }

    const [settings, associatedResult] = await Promise.all([
      guildDiscordProjectionSettings(),
      pool.query<AssociatedGuildie>(
        `SELECT da.guildie_id::text,
                da.discord_user_id,
                da.username AS discord_username,
                c.name AS main_name,
                c.realm_name AS main_realm_name
           FROM discord_associations da
           LEFT JOIN guildie_main_characters gmc
             ON gmc.guildie_id = da.guildie_id
            AND gmc.guild_id = $1
           LEFT JOIN characters c
             ON c.region = gmc.region
            AND c.realm_id = gmc.realm_id
            AND c.character_id = gmc.character_id
          ORDER BY COALESCE(c.name, da.username), da.discord_user_id`,
        [config.guild.id],
      ),
    ]);

    const rows: string[] = [];
    for (const associated of associatedResult.rows) {
      const state = await discordStateForGuildie(associated.guildie_id);
      const linkedRoleConfigured = Boolean(settings.linkedRoleId);
      const hasLinkedRole = linkedRoleConfigured && state.roleIds.includes(settings.linkedRoleId as string);
      const wantsLinkedRole = linkedRoleConfigured && state.associated && state.presentInGuild;
      const action = !linkedRoleConfigured
        ? "none"
        : wantsLinkedRole && !hasLinkedRole
          ? "add"
          : !wantsLinkedRole && hasLinkedRole
            ? "remove"
            : "none";
      const recognition = associated.main_name
        ? `${associated.main_name}${associated.main_realm_name ? ` · ${associated.main_realm_name}` : ""}`
        : `Guildie ${associated.guildie_id}`;

      rows.push(`<tr>
        <td>${htmlText(recognition)}</td>
        <td>${htmlText(associated.discord_username)}<br><small>${htmlText(associated.discord_user_id)}</small></td>
        <td>${state.presentInGuild ? "Yes" : "No"}</td>
        <td>${linkedRoleConfigured ? (hasLinkedRole ? "Yes" : "No") : "Not configured"}</td>
        <td>${linkedRoleConfigured ? (wantsLinkedRole ? "Yes" : "No") : "Not configured"}</td>
        <td>${action}</td>
        <td><time data-unix-time="${state.observedAt}">${state.observedAt}</time></td>
      </tr>`);
    }

    const body = `<section class="discord-state-inspection" aria-labelledby="discord-state-heading">
      <div class="discord-state-heading">
        <div>
          <h2 id="discord-state-heading">Linked Guildie projection inspection</h2>
          <p>This view reads current Discord state and calculates desired Linked-role state. It never changes Discord.</p>
        </div>
        <span class="discord-projection-state">Projection ${settings.enabled ? "enabled" : "disabled"}</span>
      </div>
      <div class="discord-state-table-wrap">
        <table class="discord-state-table">
          <thead><tr>
            <th scope="col">Guildie</th>
            <th scope="col">Discord</th>
            <th scope="col">In server</th>
            <th scope="col">Has Linked</th>
            <th scope="col">Should have Linked</th>
            <th scope="col">Projected action</th>
            <th scope="col">Observed</th>
          </tr></thead>
          <tbody>${rows.join("\n") || `<tr><td colspan="7">No Discord-associated Guildies.</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(renderPage(assets, {
        pathname: "/admin/discord-state",
        title: "Discord state · OH CRIT I Pulled! Guild Operations",
        description: "Inspect current Discord-linked Guildie state and projected Linked-role actions.",
        viewer,
        secondaryNavigation: discordStateNavigation,
        stylesheets: ["admin.css"],
        scripts: ["admin.js"],
        header: `<div class="admin-page-header"><h1 id="page-title">Discord state</h1><p class="lede">Read-only reconciliation inspection.</p></div>`,
        body,
      }));
  });
}
