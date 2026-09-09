import type { FastifyInstance } from "fastify";
import { guildRankDefinitions } from "../../application-state.js";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { guildieHasGuildCapability } from "../../guild-permissions.js";
import type { AssetRegistry } from "../../web/assets.js";
import { renderPage } from "../../web/render.js";
import { viewerForRequest } from "../../web/viewer.js";
import { DISCORD_ADMIN_CAPABILITY } from "./authorization.js";
import {
  discordGuildIntegrationConfigured,
  getDiscordGuildRoles,
  type DiscordGuildRole,
} from "./client.js";
import { guildDiscordProjectionSettings } from "./policy.js";

function htmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function roleOptions(roles: DiscordGuildRole[], selectedRoleId: string | null): string {
  return [
    `<option value="">Not configured</option>`,
    ...roles
      .filter((role) => !role.managed)
      .map((role) => `<option value="${htmlText(role.id)}"${role.id === selectedRoleId ? " selected" : ""}>${htmlText(role.name)}</option>`),
  ].join("");
}

async function renderRoleMaps(): Promise<string> {
  const settings = await guildDiscordProjectionSettings(undefined, true);
  if (!await discordGuildIntegrationConfigured()) {
    return `<div class="discord-admin discord-admin-unavailable">
      <h3>Role Maps</h3>
      <p>Configure and enable the Discord module with a server ID and bot token before managing role maps.</p>
      <span>Linked Role is ${settings.linkedMappingEnabled ? "on" : "off"}. Rank Mapping is ${settings.rankMappingEnabled ? "on" : "off"}.</span>
    </div>`;
  }

  let roles: DiscordGuildRole[];
  try {
    roles = await getDiscordGuildRoles();
  } catch {
    return `<div class="discord-admin discord-admin-unavailable">
      <h3>Role Maps</h3>
      <p>Discord roles could not be read.</p>
      <span>Linked Role is ${settings.linkedMappingEnabled ? "on" : "off"}. Rank Mapping is ${settings.rankMappingEnabled ? "on" : "off"}.</span>
      <a href="/admin/discord/state">Pending actions →</a>
    </div>`;
  }

  const ranks = await guildRankDefinitions();
  const rankMapping = new Map(settings.rankRoles.map((mapping) => [mapping.rankIndex, mapping.discordRoleId]));

  return `<div class="discord-admin" data-discord-admin>
    <form class="discord-projection-form discord-role-maps-form" data-discord-projection-form>
      <section class="discord-role-map-section discord-projection-form" aria-labelledby="discord-linked-role-heading">
        <div class="discord-projection-heading discord-role-map-heading">
          <div>
            <h3 id="discord-linked-role-heading">Linked Role</h3>
            <p>Map Guildies with an established Discord association to one Discord role.</p>
          </div>
          <label class="switch discord-projection-toggle">
            <input type="checkbox" data-discord-linked-mapping-enabled${settings.linkedMappingEnabled ? " checked" : ""}>
            <span class="switch-control" aria-hidden="true"></span>
            <span data-discord-linked-switch-label>${settings.linkedMappingEnabled ? "On" : "Off"}</span>
          </label>
        </div>
        <div class="discord-role-fields">
          <label>
            <span>Linked Guildie role</span>
            <select name="linkedRoleId" data-discord-role-select>${roleOptions(roles, settings.linkedRoleId)}</select>
          </label>
        </div>
      </section>

      <section class="discord-role-map-section discord-projection-form" aria-labelledby="discord-rank-mapping-heading">
        <div class="discord-projection-heading discord-role-map-heading">
          <div>
            <h3 id="discord-rank-mapping-heading">Rank Mapping</h3>
            <p>Map Blizzard-backed guild ranks to Discord roles.</p>
          </div>
          <label class="switch discord-projection-toggle">
            <input type="checkbox" data-discord-rank-mapping-enabled${settings.rankMappingEnabled ? " checked" : ""}>
            <span class="switch-control" aria-hidden="true"></span>
            <span data-discord-rank-switch-label>${settings.rankMappingEnabled ? "On" : "Off"}</span>
          </label>
        </div>
        <div class="discord-role-fields">
          ${ranks.map((rank) => `<label>
            <span>${htmlText(rank.displayName)}</span>
            <select data-discord-rank-index="${rank.rankIndex}" data-discord-role-select>
              ${roleOptions(roles, rankMapping.get(rank.rankIndex) ?? null)}
            </select>
          </label>`).join("")}
        </div>
      </section>

      <div class="discord-projection-actions">
        <button type="button" data-discord-refresh-roles>Refresh roles</button>
        <button type="submit" class="button-primary" data-discord-projection-save>Save</button>
      </div>
      <p class="discord-projection-feedback" data-discord-projection-feedback role="status" aria-live="polite"></p>
    </form>
  </div>`;
}

export async function registerDiscordRoleMapsPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/admin/discord/role-maps", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
    ]);
    if (!guildie) return reply.code(401).send("Authentication is required.");
    if (!await guildieHasGuildCapability(guildie.guildieId, DISCORD_ADMIN_CAPABILITY)) {
      return reply.code(403).send("Discord administration is not available for this account.");
    }

    const body = `<div class="admin-sections">
      <section class="admin-section" aria-labelledby="discord-role-maps-heading">
        <div class="discord-admin-heading">
          <div>
            <h2 id="discord-role-maps-heading">Role Maps</h2>
            <p>Configure how established Guild Operations facts are applied to Discord roles.</p>
          </div>
          <a class="discord-state-link" href="/admin/discord/state">Pending actions →</a>
        </div>
        ${await renderRoleMaps()}
      </section>
    </div>`;

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(renderPage(assets, {
        pathname: "/admin/discord/role-maps",
        title: "Discord role maps · OH CRIT I Pulled! Guild Operations",
        description: "Configure Discord role maps.",
        viewer,
        stylesheets: ["admin.css"],
        scripts: ["discord-admin.js"],
        secondaryNavigation: { kind: "back", href: "/admin/discord", label: "Discord" },
        header: `<div class="admin-page-header"><h1 id="page-title">Role Maps</h1><p class="lede">Configure Discord role assignments backed by Guild Operations.</p></div>`,
        body,
      }));
  });
}
