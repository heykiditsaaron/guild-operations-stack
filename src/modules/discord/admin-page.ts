import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { guildieHasGuildCapability } from "../../guild-permissions.js";
import type { AssetRegistry } from "../../web/assets.js";
import { renderPage } from "../../web/render.js";
import { viewerForRequest } from "../../web/viewer.js";
import { DISCORD_ADMIN_CAPABILITY } from "./authorization.js";
import {
  discordGuildIntegrationConfigured,
  getDiscordGuildRoles,
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

function htmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function registerDiscordAdminPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/admin/discord", async (_request, reply) => reply.redirect("/admin/general/discord"));

  app.get("/admin/general/discord", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
    ]);
    if (!guildie) return reply.code(401).send("Authentication is required.");
    if (!await guildieHasGuildCapability(guildie.guildieId, DISCORD_ADMIN_CAPABILITY)) {
      return reply.code(403).send("Discord administration is not available for this account.");
    }

    const moduleConfiguration = await discordModuleConfiguration();

    const secretWarning = moduleConfiguration.secretEncryptionAvailable
      ? ""
      : `<p class="admin-unavailable">APPLICATION_ENCRYPTION_KEY is not configured. Discord secrets cannot be stored or used until an installation encryption key is provided.</p>`;
    const moduleState = moduleConfiguration.enabled
      ? '<p class="discord-projection-state">Discord is enabled from Administration → General.</p>'
      : '<p class="discord-projection-state">Discord is currently disabled. Configuration can be prepared here before enabling it from Administration → General.</p>';

    const body = `<div class="admin-sections">
      <section class="admin-section" aria-labelledby="discord-module-heading">
        <h2 id="discord-module-heading">Discord module</h2>
        ${secretWarning}
        <div class="discord-admin settings-panel">
          <form class="discord-module-form" data-discord-module-form>
            <div class="discord-projection-heading discord-admin-heading">
              <div>
                <h3>Integration</h3>
                <p>Configure the packaged Discord integration.</p>
                ${moduleState}
              </div>
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
            <p class="discord-projection-feedback" data-discord-module-feedback role="status" aria-live="polite"></p>
          </form>
        </div>
      </section>

      <section class="admin-section">
        <a class="admin-destination" href="/admin/general/discord/role-maps">
          <span class="admin-destination-title">Role Maps</span>
          <span class="admin-destination-description">Configure Discord role projection policy.</span>
          <span class="admin-destination-arrow" aria-hidden="true">→</span>
        </a>
      </section>
    </div>`;

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(renderPage(assets, {
        pathname: "/admin/general/discord",
        title: "Discord configuration · OH CRIT I Pulled! Guild Operations",
        description: "Configure the packaged Discord integration.",
        viewer,
        stylesheets: ["admin.css"],
        scripts: ["discord-admin.js"],
        secondaryNavigation: {
          kind: "breadcrumb",
          items: [
            { label: "Administration", href: "/admin/general" },
            { label: "General", href: "/admin/general" },
            { label: "Discord" },
          ],
        },
        header: `<div class="admin-page-header"><h1 id="page-title">Discord</h1><p class="lede">Configure Guild Operations' Discord integration.</p></div>`,
        body,
      }));
  });

  const updateDiscordConfiguration = async (request: FastifyRequest, reply: FastifyReply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "not_authenticated" });
    if (!await guildieHasGuildCapability(guildie.guildieId, DISCORD_ADMIN_CAPABILITY)) {
      return reply.code(403).send({ error: "not_authorized" });
    }

    const body = request.body as Record<string, unknown>;

    if (body.action === "discord_module.update") {
      const textOrNull = (value: unknown): string | null | undefined => {
        if (value === undefined) return undefined;
        if (value === null) return null;
        if (typeof value !== "string") throw new Error("invalid_text");
        return value;
      };
      try {
        const settings = await updateDiscordModuleConfiguration({
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

    if (
      body.action !== "discord_projection.update"
      || typeof body.linkedMappingEnabled !== "boolean"
      || typeof body.rankMappingEnabled !== "boolean"
    ) {
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
        linkedMappingEnabled: body.linkedMappingEnabled,
        rankMappingEnabled: body.rankMappingEnabled,
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
  };

  app.post("/admin/general/discord", updateDiscordConfiguration);
  app.post("/admin/discord", updateDiscordConfiguration);
}
