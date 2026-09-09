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
import {
  configureGuildDiscordProjection,
  DiscordProjectionNotConfiguredError,
  DiscordProjectionReconciliationError,
  UnknownDiscordProjectionRoleError,
} from "./configuration.js";
import {
  discordModuleConfiguration,
  updateDiscordModuleConfiguration,
} from "./module-configuration.js";
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

async function renderRoleProjection(): Promise<string> {
  const settings = await guildDiscordProjectionSettings();
  if (!await discordGuildIntegrationConfigured()) {
    return `<div class="discord-admin discord-admin-unavailable">
      <h3>Managed roles</h3>
      <p>Configure and enable the Discord module with a server ID and bot token before managing role projection.</p>
      <span>Stored projection is ${settings.enabled ? "enabled" : "disabled"}.</span>
    </div>`;
  }

  let roles: DiscordGuildRole[];
  try {
    roles = await getDiscordGuildRoles();
  } catch {
    return `<div class="discord-admin discord-admin-unavailable">
      <h3>Managed roles</h3>
      <p>Discord roles could not be read. Projection is currently ${settings.enabled ? "enabled" : "disabled"}.</p>
      <a href="/admin/discord/state">Pending actions →</a>
    </div>`;
  }

  const ranks = await guildRankDefinitions();
  const rankMapping = new Map(settings.rankRoles.map((mapping) => [mapping.rankIndex, mapping.discordRoleId]));

  return `<div class="discord-admin" data-discord-admin>
    <div class="discord-admin-heading">
      <div>
        <h3>Managed roles</h3>
        <p>Project Guild Operations-managed Linked and guild-rank roles into Discord.</p>
      </div>
      <a class="discord-state-link" href="/admin/discord/state">Pending actions →</a>
    </div>
    <form class="discord-projection-form" data-discord-projection-form>
      <div class="discord-projection-heading">
        <div>
          <h4>Role projection</h4>
          <p>Observation remains available while projection is disabled.</p>
        </div>
        <label class="switch discord-projection-toggle">
          <input type="checkbox" name="enabled" data-discord-projection-enabled${settings.enabled ? " checked" : ""}>
          <span class="switch-control" aria-hidden="true"></span>
          <span data-discord-switch-label>${settings.enabled ? "On" : "Off"}</span>
        </label>
      </div>
      <div class="discord-role-fields">
        <label>
          <span>Linked Guildie role</span>
          <select name="linkedRoleId" data-discord-role-select>${roleOptions(roles, settings.linkedRoleId)}</select>
        </label>
        ${ranks.map((rank) => `<label>
          <span>${htmlText(rank.displayName)}</span>
          <select data-discord-rank-index="${rank.rankIndex}" data-discord-role-select>
            ${roleOptions(roles, rankMapping.get(rank.rankIndex) ?? null)}
          </select>
        </label>`).join("")}
      </div>
      <div class="discord-projection-actions">
        <button type="button" data-discord-refresh-roles>Refresh roles</button>
        <button type="submit" class="button-primary" data-discord-projection-save>Save</button>
      </div>
      <p class="discord-projection-feedback" data-discord-projection-feedback role="status" aria-live="polite"></p>
    </form>
  </div>`;
}

export async function registerDiscordAdminPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/admin/discord", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
    ]);
    if (!guildie) return reply.code(401).send("Authentication is required.");
    if (!await guildieHasGuildCapability(guildie.guildieId, DISCORD_ADMIN_CAPABILITY)) {
      return reply.code(403).send("Discord administration is not available for this account.");
    }

    const [moduleConfiguration, roleProjection] = await Promise.all([
      discordModuleConfiguration(),
      renderRoleProjection(),
    ]);

    const secretWarning = moduleConfiguration.secretEncryptionAvailable
      ? ""
      : `<p class="admin-unavailable">APPLICATION_ENCRYPTION_KEY is not configured. Discord secrets cannot be stored or used until an installation encryption key is provided.</p>`;

    const body = `<div class="admin-sections">
      <section class="admin-section" aria-labelledby="discord-module-heading">
        <h2 id="discord-module-heading">Discord module</h2>
        ${secretWarning}
        <form class="discord-module-form" data-discord-module-form>
          <div class="discord-projection-heading">
            <div>
              <h3>Integration</h3>
              <p>Enable Discord as a packaged Guild Operations integration.</p>
            </div>
            <label class="switch discord-projection-toggle">
              <input type="checkbox" data-discord-module-enabled${moduleConfiguration.enabled ? " checked" : ""}>
              <span class="switch-control" aria-hidden="true"></span>
              <span data-discord-module-switch-label>${moduleConfiguration.enabled ? "On" : "Off"}</span>
            </label>
          </div>
          <div class="discord-role-fields">
            <label><span>Application ID</span><input type="text" data-discord-client-id value="${htmlText(moduleConfiguration.clientId ?? "")}" autocomplete="off"></label>
            <label><span>Application secret</span><input type="password" data-discord-client-secret value="" autocomplete="new-password" placeholder="${moduleConfiguration.clientSecretConfigured ? "Configured — leave blank to keep" : "Not configured"}"></label>
            <label><span><input type="checkbox" data-discord-client-secret-remove> Remove stored application secret</span></label>
            <label><span>Discord server ID</span><input type="text" data-discord-guild-id value="${htmlText(moduleConfiguration.discordGuildId ?? "")}" autocomplete="off"></label>
            <label><span>Bot token</span><input type="password" data-discord-bot-token value="" autocomplete="new-password" placeholder="${moduleConfiguration.botTokenConfigured ? "Configured — leave blank to keep" : "Not configured"}"></label>
            <label><span><input type="checkbox" data-discord-bot-token-remove> Remove stored bot token</span></label>
            <label><span>Discord invite URL</span><input type="url" data-discord-invite-url value="${htmlText(moduleConfiguration.inviteUrl ?? "")}" placeholder="https://discord.gg/..."></label>
          </div>
          <div class="discord-projection-actions"><button type="submit" class="button-primary" data-discord-module-save>Save Discord configuration</button></div>
          <p data-discord-module-feedback role="status" aria-live="polite"></p>
        </form>
      </section>
      <section class="admin-section" aria-labelledby="discord-roles-heading">
        <h2 id="discord-roles-heading">Discord roles</h2>
        ${roleProjection}
      </section>
    </div>`;

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(renderPage(assets, {
        pathname: "/admin/discord",
        title: "Discord administration · OH CRIT I Pulled! Guild Operations",
        description: "Configure the packaged Discord integration.",
        viewer,
        stylesheets: ["admin.css"],
        scripts: ["discord-admin.js"],
        header: `<div class="admin-page-header"><h1 id="page-title">Discord</h1><p class="lede">Configure Guild Operations' Discord integration.</p></div>`,
        body,
      }));
  });

  app.post("/admin/discord", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "not_authenticated" });
    if (!await guildieHasGuildCapability(guildie.guildieId, DISCORD_ADMIN_CAPABILITY)) {
      return reply.code(403).send({ error: "not_authorized" });
    }

    const body = request.body as Record<string, unknown>;

    if (body.action === "discord_module.update") {
      if (typeof body.enabled !== "boolean") return reply.code(400).send({ error: "invalid_module_configuration" });
      const textOrNull = (value: unknown): string | null | undefined => {
        if (value === undefined) return undefined;
        if (value === null) return null;
        if (typeof value !== "string") throw new Error("invalid_text");
        return value;
      };
      try {
        const settings = await updateDiscordModuleConfiguration({
          enabled: body.enabled,
          clientId: textOrNull(body.clientId) ?? null,
          discordGuildId: textOrNull(body.discordGuildId) ?? null,
          inviteUrl: textOrNull(body.inviteUrl) ?? null,
          clientSecret: body.removeClientSecret === true ? null : textOrNull(body.clientSecret),
          botToken: body.removeBotToken === true ? null : textOrNull(body.botToken),
        });
        return reply.send({ settings });
      } catch (error) {
        if (error instanceof Error && (error.message === "invalid_text" || error.message.includes("APPLICATION_ENCRYPTION_KEY") || error.message.includes("Discord invite URL"))) {
          return reply.code(400).send({ error: "invalid_module_configuration", message: error.message });
        }
        throw error;
      }
    }

    if (body.action === "discord_roles.refresh") {
      if (!await discordGuildIntegrationConfigured()) {
        return reply.code(503).send({ error: "discord_not_configured" });
      }
      const roles = await getDiscordGuildRoles();
      return reply.send({
        roles: roles.filter((role) => !role.managed).map((role) => ({ id: role.id, name: role.name })),
      });
    }

    if (body.action !== "discord_projection.update" || typeof body.enabled !== "boolean") {
      return reply.code(400).send({ error: "invalid_admin_request" });
    }
    if (body.linkedRoleId !== null && typeof body.linkedRoleId !== "string") {
      return reply.code(400).send({ error: "invalid_linked_role" });
    }
    if (!Array.isArray(body.rankRoles)) return reply.code(400).send({ error: "invalid_rank_roles" });

    const rankRoles = body.rankRoles.map((mapping) => {
      if (!mapping || typeof mapping !== "object") return null;
      const typed = mapping as { rankIndex?: unknown; discordRoleId?: unknown };
      if (!Number.isInteger(typed.rankIndex) || (typed.rankIndex as number) < 0 || typeof typed.discordRoleId !== "string") return null;
      return { rankIndex: typed.rankIndex as number, discordRoleId: typed.discordRoleId };
    });
    if (rankRoles.some((mapping) => mapping === null)) return reply.code(400).send({ error: "invalid_rank_roles" });

    try {
      const settings = await configureGuildDiscordProjection({
        enabled: body.enabled,
        linkedRoleId: typeof body.linkedRoleId === "string" ? body.linkedRoleId : null,
        rankRoles: rankRoles.filter((mapping): mapping is NonNullable<typeof mapping> => mapping !== null),
      });
      return reply.send({ settings });
    } catch (error) {
      if (error instanceof DiscordProjectionNotConfiguredError) return reply.code(503).send({ error: "discord_not_configured" });
      if (error instanceof UnknownDiscordProjectionRoleError) {
        return reply.code(400).send({ error: error.roleKind === "linked" ? "unknown_linked_role" : "unknown_rank_role" });
      }
      if (error instanceof DiscordProjectionReconciliationError) {
        request.log.error({ err: error.cause }, "Discord projection reconciliation failed");
        return reply.code(502).send({ error: "discord_reconciliation_failed", settings: error.settings });
      }
      throw error;
    }
  });
}
