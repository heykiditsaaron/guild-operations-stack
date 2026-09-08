import type { FastifyInstance } from "fastify";
import { guildRankDefinitions } from "../../application-state.js";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { guildRefreshStatus } from "../../guild-admin.js";
import {
  GUILD_REFRESH_MINIMUM_INTERVAL_SECONDS,
  guildRefreshSchedule,
  type GuildRefreshSchedule,
} from "../../guild-refresh-schedule.js";
import {
  GUILD_DISCORD_MANAGE_CAPABILITY,
  GUILD_REFRESH_CAPABILITY,
  OPERATIONS_INSPECT_CAPABILITY,
  guildieHasGuildCapability,
} from "../../guild-permissions.js";
import {
  discordGuildIntegrationConfigured,
  getDiscordGuildRoles,
  type DiscordGuildRole,
} from "../../guildie-discord/client.js";
import {
  configureGuildDiscordProjection,
  DiscordProjectionNotConfiguredError,
  DiscordProjectionReconciliationError,
  UnknownDiscordProjectionRoleError,
} from "../../guildie-discord/configuration.js";
import { guildDiscordProjectionSettings } from "../../guildie-discord/policy.js";
import { raffleGuildieCanAdminister } from "../../modules/raffle/authorization.js";
import type { AssetRegistry } from "../assets.js";
import { renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

function htmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function destination(title: string, description: string, href: string): string {
  return `<a class="admin-destination" href="${href}">
    <span class="admin-destination-title">${title}</span>
    <span class="admin-destination-description">${description}</span>
    <span class="admin-destination-arrow" aria-hidden="true">→</span>
  </a>`;
}

function administrationSection(
  sectionId: string,
  headingId: string,
  heading: string,
  content: string,
): string {
  return `<section id="${sectionId}" class="admin-section" aria-labelledby="${headingId}">
    <h2 id="${headingId}">${heading}</h2>
    ${content}
  </section>`;
}

function renderGuildRefresh(
  status: Awaited<ReturnType<typeof guildRefreshStatus>>,
  schedule: GuildRefreshSchedule,
): string {
  const memberCount = status
    ? `<strong>${status.currentMemberCount.toLocaleString("en-US")}</strong><span>current members</span>`
    : `<strong>—</strong><span>current members</span>`;
  const lastReconciled = status
    ? `<time data-unix-time="${status.lastReconciledAtUnix}">${status.lastReconciledAtUnix}</time>`
    : "Not yet observed";
  const nextAutomaticRefresh = schedule.nextDueAtUnix === null
    ? "Disabled"
    : `<time data-unix-time="${schedule.nextDueAtUnix}">${schedule.nextDueAtUnix}</time>`;

  return `<div class="guild-refresh-admin" data-guild-refresh-admin>
    <div class="guild-refresh-admin-heading">
      <div>
        <h3>Guild refresh</h3>
        <p>Reconcile current guild membership and rank authority from Blizzard.</p>
      </div>
      <button type="button" class="guild-refresh-button button-primary" data-guild-refresh-button>Refresh now</button>
    </div>
    <div class="guild-refresh-status">
      <div class="guild-refresh-stat">
        ${memberCount}
      </div>
      <div class="guild-refresh-stat">
        <span>Last reconciled</span>
        <strong>${lastReconciled}</strong>
      </div>
    </div>
    <p class="guild-refresh-feedback" data-guild-refresh-feedback role="status" aria-live="polite"></p>

    <form class="guild-refresh-schedule" data-guild-refresh-schedule-form>
      <div class="guild-refresh-schedule-heading">
        <div>
          <h4>Automatic refresh</h4>
          <p>Run guild refresh from Guild Operations on a repeating cadence.</p>
        </div>
        <label class="switch guild-refresh-toggle">
          <input type="checkbox" data-guild-refresh-schedule-enabled${schedule.enabled ? " checked" : ""}>
          <span class="switch-control" aria-hidden="true"></span>
          <span data-switch-label>${schedule.enabled ? "On" : "Off"}</span>
        </label>
      </div>
      <div class="guild-refresh-schedule-controls">
        <label>
          <span>Every</span>
          <input
            type="number"
            min="${GUILD_REFRESH_MINIMUM_INTERVAL_SECONDS}"
            step="1"
            value="${schedule.intervalSeconds}"
            inputmode="numeric"
            data-guild-refresh-schedule-interval
          >
          <span>seconds</span>
        </label>
        <button type="submit" class="button-primary" data-guild-refresh-schedule-save>Save</button>
      </div>
      <div class="guild-refresh-schedule-next">
        <span>Next automatic refresh</span>
        <strong data-guild-refresh-schedule-next>${nextAutomaticRefresh}</strong>
      </div>
      <p class="guild-refresh-schedule-feedback" data-guild-refresh-schedule-feedback role="status" aria-live="polite"></p>
    </form>
  </div>`;
}

function roleOptions(roles: DiscordGuildRole[], selectedRoleId: string | null): string {
  return [
    `<option value="">Not configured</option>`,
    ...roles
      .filter((role) => !role.managed)
      .map((role) => `<option value="${htmlText(role.id)}"${role.id === selectedRoleId ? " selected" : ""}>${htmlText(role.name)}</option>`),
  ].join("");
}

async function renderDiscordAdministration(): Promise<string> {
  const settings = await guildDiscordProjectionSettings();

  if (!discordGuildIntegrationConfigured()) {
    return `<div class="discord-admin discord-admin-unavailable">
      <h3>Discord roles</h3>
      <p>Direct Discord guild integration is not configured. No Discord observation or role mutation can run.</p>
      <span>Stored projection is ${settings.enabled ? "enabled" : "disabled"}.</span>
    </div>`;
  }

  let roles: DiscordGuildRole[];
  try {
    roles = await getDiscordGuildRoles();
  } catch {
    return `<div class="discord-admin discord-admin-unavailable">
      <h3>Discord roles</h3>
      <p>Discord roles could not be read. Projection is currently ${settings.enabled ? "enabled" : "disabled"}.</p>
      <a href="/admin/discord-state">Pending actions →</a>
    </div>`;
  }

  const ranks = await guildRankDefinitions();
  const rankMapping = new Map(settings.rankRoles.map((mapping) => [mapping.rankIndex, mapping.discordRoleId]));

  return `<div class="discord-admin" data-discord-admin>
    <div class="discord-admin-heading">
      <div>
        <h3>Discord roles</h3>
        <p>Project Guild Operations-managed Linked and guild-rank roles into Discord.</p>
      </div>
      <a class="discord-state-link" href="/admin/discord-state">Pending actions →</a>
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

export async function registerAdminPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/admin", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
    ]);
    const [canRefreshGuild, canInspectOperations, canAdministerDiscord, canAdministerRaffle] = guildie
      ? await Promise.all([
          guildieHasGuildCapability(guildie.guildieId, GUILD_REFRESH_CAPABILITY),
          guildieHasGuildCapability(guildie.guildieId, OPERATIONS_INSPECT_CAPABILITY),
          guildieHasGuildCapability(guildie.guildieId, GUILD_DISCORD_MANAGE_CAPABILITY),
          raffleGuildieCanAdminister(guildie.guildieId),
        ])
      : [false, false, false, false];

    const [refreshStatus, refreshSchedule, discordAdministration] = await Promise.all([
      canRefreshGuild ? guildRefreshStatus() : Promise.resolve(null),
      canRefreshGuild ? guildRefreshSchedule() : Promise.resolve(null),
      canAdministerDiscord ? renderDiscordAdministration() : Promise.resolve(""),
    ]);

    const availableAdministration: string[] = [];

    if (canAdministerRaffle) {
      availableAdministration.push(destination(
        "Raffle",
        "Create and operate guild raffles.",
        "/admin/raffle",
      ));
    }

    const hasAdministration = canRefreshGuild
      || canInspectOperations
      || canAdministerDiscord
      || availableAdministration.length > 0;
    const guildSettings = canRefreshGuild && refreshSchedule
      ? administrationSection(
          "guild-settings",
          "guild-settings-heading",
          "Guild settings",
          renderGuildRefresh(refreshStatus, refreshSchedule),
        )
      : "";
    const discordSettings = canAdministerDiscord
      ? administrationSection(
          "discord-settings",
          "discord-settings-heading",
          "Discord",
          discordAdministration,
        )
      : "";
    const modules = availableAdministration.length
      ? administrationSection(
          "available-administration",
          "available-administration-heading",
          "Available administration",
          `<div class="admin-destinations">${availableAdministration.join("\n")}</div>`,
        )
      : "";

    const body = hasAdministration
      ? `<div class="admin-sections">
          ${guildSettings}
          ${discordSettings}
          ${modules}
        </div>`
      : `<section class="admin-unavailable" aria-labelledby="admin-unavailable-heading">
          <h2 id="admin-unavailable-heading">Administration is not available for this account.</h2>
        </section>`;

    const logUtility = canInspectOperations
      ? '<a class="admin-header-utility" href="/admin/operations">View logs</a>'
      : "";

    const html = renderPage(assets, {
      pathname: "/admin",
      title: "Administration · OH CRIT I Pulled! Guild Operations",
      description: "Guild Operations administration.",
      viewer,
      stylesheets: ["admin.css"],
      scripts: ["admin.js"],
      header: `
        <div class="admin-page-header-row">
          <div class="admin-page-header">
            <h1 id="page-title">Administration</h1>
            <p class="lede">Operate and configure the guild.</p>
          </div>
          ${logUtility}
        </div>`,
      body,
    });

    if (!hasAdministration) {
      return reply
        .code(guildie ? 403 : 401)
        .header("Cache-Control", "no-cache")
        .type("text/html; charset=utf-8")
        .send(html);
    }

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });

  app.post("/admin", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const guildie = await authenticatedGuildie(sessionToken);
    if (!guildie) return reply.code(401).send({ error: "not_authenticated" });
    if (!await guildieHasGuildCapability(guildie.guildieId, GUILD_DISCORD_MANAGE_CAPABILITY)) {
      return reply.code(403).send({ error: "not_authorized" });
    }

    const body = request.body as {
      action?: unknown;
      enabled?: unknown;
      linkedRoleId?: unknown;
      rankRoles?: unknown;
    };

    if (body.action === "discord_roles.refresh") {
      if (!discordGuildIntegrationConfigured()) {
        return reply.code(503).send({ error: "discord_not_configured" });
      }
      const roles = await getDiscordGuildRoles();
      return reply.send({
        roles: roles
          .filter((role) => !role.managed)
          .map((role) => ({ id: role.id, name: role.name })),
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
    if (rankRoles.some((mapping) => mapping === null)) {
      return reply.code(400).send({ error: "invalid_rank_roles" });
    }

    try {
      const settings = await configureGuildDiscordProjection({
        enabled: body.enabled,
        linkedRoleId: typeof body.linkedRoleId === "string" ? body.linkedRoleId : null,
        rankRoles: rankRoles.filter((mapping): mapping is NonNullable<typeof mapping> => mapping !== null),
      });
      return reply.send({ settings });
    } catch (error) {
      if (error instanceof DiscordProjectionNotConfiguredError) {
        return reply.code(503).send({ error: "discord_not_configured" });
      }
      if (error instanceof UnknownDiscordProjectionRoleError) {
        return reply.code(400).send({
          error: error.roleKind === "linked" ? "unknown_linked_role" : "unknown_rank_role",
        });
      }
      if (error instanceof DiscordProjectionReconciliationError) {
        request.log.error({ err: error.cause }, "Discord projection reconciliation failed");
        return reply.code(502).send({
          error: "discord_reconciliation_failed",
          settings: error.settings,
        });
      }
      throw error;
    }
  });
}
