import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { guildRefreshStatus } from "../../guild-admin.js";
import {
  GUILD_REFRESH_MINIMUM_INTERVAL_SECONDS,
  guildRefreshSchedule,
  type GuildRefreshSchedule,
} from "../../guild-refresh-schedule.js";
import {
  GUILD_REFRESH_CAPABILITY,
  MODULES_CONFIGURE_CAPABILITY,
  OPERATIONS_INSPECT_CAPABILITY,
  RAID_PERMISSIONS_CAPABILITY,
  guildieHasGuildCapability,
  guildieHasGuildCapabilityOrOperator,
} from "../../guild-permissions.js";
import {
  isPackagedModuleKey,
  packagedModuleStates,
  setPackagedModuleEnabled,
  type PackagedModuleState,
} from "../../module-lifecycle.js";
import { administrationAvailabilityForGuildie } from "../administration.js";
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
  return `<a class="admin-destination" href="${htmlText(href)}">
    <span class="admin-destination-title">${htmlText(title)}</span>
    <span class="admin-destination-description">${htmlText(description)}</span>
    <span class="admin-destination-arrow" aria-hidden="true">→</span>
  </a>`;
}

function administrationTabs(current: "general" | "permissions"): string {
  return `<nav class="admin-tabs" aria-label="Administration sections">
    <a href="/admin/general"${current === "general" ? ' aria-current="page"' : ""}>General</a>
    <a href="/admin/permissions"${current === "permissions" ? ' aria-current="page"' : ""}>Permissions</a>
  </nav>`;
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

function renderModuleLifecycle(modules: PackagedModuleState[]): string {
  return `<div class="admin-module-list">${modules.map((module) => `<article class="admin-module" data-module-key="${module.key}">
    <div class="admin-module-copy">
      <div class="admin-module-heading">
        <h3>${htmlText(module.label)}</h3>
        <span class="admin-module-availability">Available</span>
      </div>
      <p>${module.enabled ? "Enabled for Guild Operations." : "Installed but disabled."}</p>
    </div>
    <label class="switch admin-module-toggle">
      <input type="checkbox" data-module-enabled${module.enabled ? " checked" : ""}>
      <span class="switch-control" aria-hidden="true"></span>
      <span data-module-switch-label>${module.enabled ? "On" : "Off"}</span>
    </label>
    <p class="admin-module-feedback" data-module-feedback role="status" aria-live="polite"></p>
  </article>`).join("\n")}</div>`;
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
      <div class="guild-refresh-stat">${memberCount}</div>
      <div class="guild-refresh-stat"><span>Last reconciled</span><strong>${lastReconciled}</strong></div>
    </div>
    <p class="guild-refresh-feedback" data-guild-refresh-feedback role="status" aria-live="polite"></p>

    <form class="guild-refresh-schedule" data-guild-refresh-schedule-form>
      <div class="guild-refresh-schedule-heading">
        <div><h4>Automatic refresh</h4><p>Run guild refresh from Guild Operations on a repeating cadence.</p></div>
        <label class="switch guild-refresh-toggle">
          <input type="checkbox" data-guild-refresh-schedule-enabled${schedule.enabled ? " checked" : ""}>
          <span class="switch-control" aria-hidden="true"></span>
          <span data-switch-label>${schedule.enabled ? "On" : "Off"}</span>
        </label>
      </div>
      <div class="guild-refresh-schedule-controls">
        <label>
          <span>Every</span>
          <input type="number" min="${GUILD_REFRESH_MINIMUM_INTERVAL_SECONDS}" step="1" value="${schedule.intervalSeconds}" inputmode="numeric" data-guild-refresh-schedule-interval>
          <span>seconds</span>
        </label>
        <button type="submit" class="button-primary" data-guild-refresh-schedule-save>Save</button>
      </div>
      <div class="guild-refresh-schedule-next"><span>Next automatic refresh</span><strong data-guild-refresh-schedule-next>${nextAutomaticRefresh}</strong></div>
      <p class="guild-refresh-schedule-feedback" data-guild-refresh-schedule-feedback role="status" aria-live="polite"></p>
    </form>
  </div>`;
}

export async function registerAdminPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/admin", async (_request, reply) => reply.redirect("/admin/general"));

  app.get("/admin/general", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
    ]);

    const [canRefreshGuild, canInspectOperations, canConfigureModules, administration] = guildie
      ? await Promise.all([
          guildieHasGuildCapability(guildie.guildieId, GUILD_REFRESH_CAPABILITY),
          guildieHasGuildCapability(guildie.guildieId, OPERATIONS_INSPECT_CAPABILITY),
          guildieHasGuildCapabilityOrOperator(guildie.guildieId, MODULES_CONFIGURE_CAPABILITY),
          administrationAvailabilityForGuildie(guildie.guildieId),
        ])
      : [false, false, false, null];

    const [refreshStatus, refreshSchedule, modulesState] = await Promise.all([
      canRefreshGuild ? guildRefreshStatus() : Promise.resolve(null),
      canRefreshGuild ? guildRefreshSchedule() : Promise.resolve(null),
      canConfigureModules ? packagedModuleStates() : Promise.resolve([]),
    ]);

    const moduleDestinations = administration?.navigationDestinations.filter((item) => item.href !== "/admin") ?? [];
    const hasAdministration = administration?.available === true;

    const moduleLifecycle = canConfigureModules
      ? administrationSection(
          "modules",
          "modules-heading",
          "Modules",
          `${renderModuleLifecycle(modulesState)}<p class="admin-section-note">Enablement controls whether an installed module participates in Guild Operations. Acquisition or entitlement is a separate concern and is not implemented here.</p>`,
        )
      : "";

    const guildSettings = canRefreshGuild && refreshSchedule
      ? administrationSection("guild-settings", "guild-settings-heading", "Guild settings", renderGuildRefresh(refreshStatus, refreshSchedule))
      : "";

    const modules = moduleDestinations.length
      ? administrationSection(
          "available-administration",
          "available-administration-heading",
          "Current module tools",
          `<div class="admin-destinations">${moduleDestinations.map((item) => destination(item.label, `Open the current ${item.label} privileged surface.`, item.href)).join("\n")}</div>`,
        )
      : "";

    const content = hasAdministration
      ? `<div class="admin-sections">${moduleLifecycle}${guildSettings}${modules}</div>`
      : `<section class="admin-unavailable" aria-labelledby="admin-unavailable-heading"><h2 id="admin-unavailable-heading">Administration is not available for this account.</h2></section>`;
    const body = `${administrationTabs("general")}${content}`;

    const logUtility = canInspectOperations
      ? '<a class="admin-header-utility" href="/admin/operations">View logs</a>'
      : "";

    const html = renderPage(assets, {
      pathname: "/admin/general",
      title: "General Administration · OH CRIT I Pulled! Guild Operations",
      description: "Configure Guild Operations.",
      viewer,
      stylesheets: ["admin.css", "admin-modules.css"],
      scripts: ["admin.js", "admin-modules.js"],
      header: `<div class="admin-page-header-row"><div class="admin-page-header"><h1 id="page-title">Administration</h1><p class="lede">Configure Guild Operations and its modules.</p></div>${logUtility}</div>`,
      body,
    });

    if (!hasAdministration) {
      return reply.code(guildie ? 403 : 401).header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
    }

    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  });

  app.put("/admin/general/modules/:moduleKey", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "authentication_required" });
    if (!await guildieHasGuildCapabilityOrOperator(guildie.guildieId, MODULES_CONFIGURE_CAPABILITY)) {
      return reply.code(403).send({ error: "module_configuration_not_authorized" });
    }

    const params = request.params as { moduleKey?: unknown };
    const body = (request.body ?? {}) as { enabled?: unknown };
    if (typeof params.moduleKey !== "string" || !isPackagedModuleKey(params.moduleKey)) {
      return reply.code(404).send({ error: "unknown_module" });
    }
    if (typeof body.enabled !== "boolean") {
      return reply.code(400).send({ error: "enabled_must_be_boolean" });
    }

    const module = await setPackagedModuleEnabled(params.moduleKey, body.enabled);
    return reply.send({ module });
  });

  app.get("/admin/permissions", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
    ]);

    const [administration, canConfigureRaidPermissions] = guildie
      ? await Promise.all([
          administrationAvailabilityForGuildie(guildie.guildieId),
          guildieHasGuildCapabilityOrOperator(guildie.guildieId, RAID_PERMISSIONS_CAPABILITY),
        ])
      : [null, false];
    const hasAdministration = administration?.available === true;

    const permissionDestinations = canConfigureRaidPermissions
      ? `<div class="admin-destinations">${destination(
          "Raid",
          "Map current Blizzard guild ranks to Raid creation and management capabilities.",
          "/admin/permissions/raid",
        )}</div>`
      : `<p class="admin-empty-state">No configurable permission policies are available for this account.</p>`;

    const content = hasAdministration
      ? `<div class="admin-sections">${administrationSection(
          "configurable-permissions",
          "configurable-permissions-heading",
          "Configurable permissions",
          permissionDestinations,
        )}</div>`
      : `<section class="admin-unavailable" aria-labelledby="admin-unavailable-heading"><h2 id="admin-unavailable-heading">Administration is not available for this account.</h2></section>`;
    const body = `${administrationTabs("permissions")}${content}`;

    const html = renderPage(assets, {
      pathname: "/admin/permissions",
      title: "Permissions Administration · OH CRIT I Pulled! Guild Operations",
      description: "Configure Guild Operations permission policy.",
      viewer,
      stylesheets: ["admin.css"],
      header: `<div class="admin-page-header"><h1 id="page-title">Administration</h1><p class="lede">Configure who may operate Guild Operations capabilities.</p></div>`,
      body,
    });

    if (!hasAdministration) {
      return reply.code(guildie ? 403 : 401).header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
    }

    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  });
}
