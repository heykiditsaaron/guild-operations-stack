import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { guildRefreshStatus } from "../../core/guild/guild-refresh-status.js";
import {
  canAdministerGuildPermissions,
  guildCapabilityPoliciesForActor,
  setGuildCapabilityPermittedRanks,
  type GuildCapabilityPolicySet,
} from "../../core/authority/guild-capability-policy.js";
import {
  GUILD_REFRESH_MINIMUM_INTERVAL_SECONDS,
  guildRefreshSchedule,
  type GuildRefreshSchedule,
} from "../../core/guild/guild-refresh-schedule.js";
import {
  GUILD_REFRESH_CAPABILITY,
  GUILD_REFRESH_SCHEDULE_CONFIGURE_CAPABILITY,
  GUILD_PRESENTATION_CONFIGURE_CAPABILITY,
  MODULES_CONFIGURE_CAPABILITY,
  THEME_CONFIGURE_CAPABILITY,
  guildieHasGuildCapability,
  guildieHasGuildCapabilityOrOperator,
} from "../../core/authority/guild-permissions.js";
import {
  isPackagedCapabilityKey,
  packagedCapabilityStates,
  setPackagedCapabilityEnabled,
  type PackagedCapabilityState,
} from "../../packaged-capability-lifecycle.js";
import { hasDevelopmentGuildMasterAuthority } from "../../core/authority/operator-authority.js";
import { GUILD_THEMES, guildTheme, isGuildThemeKey, setGuildTheme, type GuildThemeKey } from "../../core/presentation/guild-theme.js";
import { guildPresentation, parseGuildPresentationUrl, setGuildPresentationDestinations, type GuildPresentation } from "../../core/presentation/guild-presentation.js";
import { administrationAvailabilityForGuildie } from "../administration.js";
import type { AssetRegistry } from "../assets.js";
import { renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

function htmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function administrationSection(sectionId: string, headingId: string, heading: string, content: string): string {
  return `<section id="${sectionId}" class="admin-section" aria-labelledby="${headingId}"><h2 id="${headingId}">${heading}</h2>${content}</section>`;
}

function renderPackagedCapabilityLifecycle(capabilities: PackagedCapabilityState[], canConfigureDiscord: boolean): string {
  const renderGroup = (kind: "module" | "plugin", heading: string) => {
    const members = capabilities.filter((capability) => capability.kind === kind);
    if (members.length === 0) return "";
    return `<section class="packaged-capability-group"><h3>${heading}</h3><div class="module-lifecycle-list">${members.map((module) => {

    const configurationAction = module.key === "discord" && canConfigureDiscord ? `<a class="module-lifecycle-configure" href="/admin/plugins/discord">Configure integration <span aria-hidden="true">→</span></a>` : "";
    return `<article class="module-lifecycle-card settings-panel" data-module-key="${module.key}"><div class="module-lifecycle-copy"><div class="module-lifecycle-heading"><h3>${htmlText(module.label)}</h3><span class="module-lifecycle-availability">Available</span></div><p>${module.enabled ? "Enabled for Guild Operations." : "Installed but disabled."}</p>${configurationAction}</div><label class="switch module-lifecycle-toggle"><input type="checkbox" data-module-enabled${module.enabled ? " checked" : ""}><span class="switch-control" aria-hidden="true"></span><span data-module-switch-label>${module.enabled ? "On" : "Off"}</span></label><p class="module-lifecycle-feedback" data-module-feedback role="status" aria-live="polite"></p></article>`;
    }).join("\n")}</div></section>`;
  };
  return `${renderGroup("module", "Modules")}${renderGroup("plugin", "Plugins")}`;
}

function renderGuildRefreshSchedule(schedule: GuildRefreshSchedule): string {
  const nextAutomaticRefresh = schedule.nextDueAtUnix === null ? "Disabled" : `<time data-unix-time="${schedule.nextDueAtUnix}">${schedule.nextDueAtUnix}</time>`;
  return `<form class="guild-refresh-schedule" data-guild-refresh-schedule-form><div class="guild-refresh-schedule-heading"><div><h3>Automatic guild refresh</h3><p>Reconcile current guild membership and rank authority from Blizzard on a repeating cadence.</p></div><label class="switch guild-refresh-toggle"><input type="checkbox" data-guild-refresh-schedule-enabled${schedule.enabled ? " checked" : ""}><span class="switch-control" aria-hidden="true"></span><span data-switch-label>${schedule.enabled ? "On" : "Off"}</span></label></div><div class="guild-refresh-schedule-controls"><label><span>Every</span><input type="number" min="${GUILD_REFRESH_MINIMUM_INTERVAL_SECONDS}" step="1" value="${schedule.intervalSeconds}" inputmode="numeric" data-guild-refresh-schedule-interval><span>seconds</span></label><button type="submit" class="button-primary" data-guild-refresh-schedule-save>Save</button></div><div class="guild-refresh-schedule-next"><span>Next automatic refresh</span><strong data-guild-refresh-schedule-next>${nextAutomaticRefresh}</strong></div><p class="guild-refresh-schedule-feedback" data-guild-refresh-schedule-feedback role="status" aria-live="polite"></p></form>`;
}

function renderGuildRefreshOperation(status: Awaited<ReturnType<typeof guildRefreshStatus>>, canRefresh: boolean): string {
  const memberCount = status ? status.currentMemberCount.toLocaleString("en-US") : "—";
  const lastReconciled = status ? `<time data-unix-time="${status.lastReconciledAtUnix}">${status.lastReconciledAtUnix}</time>` : "Not yet observed";
  return `<div class="guild-refresh-admin" data-guild-refresh-admin><div class="guild-refresh-admin-heading"><div><h3>Manual guild refresh</h3><p>Reconcile current guild membership and rank authority from Blizzard now.</p></div><button type="button" class="guild-refresh-button button-primary" data-guild-refresh-button${canRefresh ? "" : " disabled"}>Refresh now</button></div><div class="guild-refresh-status"><div class="guild-refresh-stat"><strong>${memberCount}</strong><span>current members</span></div><div class="guild-refresh-stat"><span>Last reconciled</span><strong>${lastReconciled}</strong></div></div><p class="guild-refresh-feedback" data-guild-refresh-feedback role="status" aria-live="polite"></p></div>`;
}

function renderThemeSettings(theme: GuildThemeKey): string {
  const options = GUILD_THEMES.map((candidate) => `<option value="${candidate.key}"${candidate.key === theme ? " selected" : ""}>${htmlText(candidate.label)}</option>`).join("");
  return `<form class="settings-panel theme-settings" data-theme-settings-form><div><h3>Theme</h3><p>Choose the color palette used throughout Guild Operations for this guild.</p></div><div class="theme-settings-controls"><label><span>Palette</span><select data-theme-select>${options}</select></label><button type="submit" class="button-primary" data-theme-save>Save</button></div><p class="theme-settings-feedback" data-theme-feedback role="status" aria-live="polite"></p></form>`;
}

function renderGuildPresentationSettings(presentation: GuildPresentation): string {
  return `<form class="settings-panel guild-presentation-settings" data-guild-presentation-form><div><h3>Guild links</h3><p>Optional third-party destinations presented for this guild. Blizzard identity and the WoW Armory destination are derived from observed guild truth.</p></div><div class="theme-settings-controls"><label><span>Raider.IO URL</span><input type="url" value="${htmlText(presentation.raiderIoUrl ?? "")}" placeholder="https://" data-raider-io-url></label><label><span>Warcraft Logs URL</span><input type="url" value="${htmlText(presentation.warcraftLogsUrl ?? "")}" placeholder="https://" data-warcraft-logs-url></label><button type="submit" class="button-primary" data-guild-presentation-save>Save</button></div><p class="theme-settings-feedback" data-guild-presentation-feedback role="status" aria-live="polite"></p></form>`;
}

function rankSummary(policy: GuildCapabilityPolicySet["capabilities"][number], ranks: GuildCapabilityPolicySet["ranks"]): string {
  const guildMaster = ranks.find((rank) => rank.rankIndex === 0)?.displayName ?? "Rank 0";
  const names = policy.permittedRanks.map((rankIndex) => ranks.find((rank) => rank.rankIndex === rankIndex)?.displayName ?? `Rank ${rankIndex}`);
  const effectiveNames = [guildMaster, ...names];
  return effectiveNames.length <= 3 ? effectiveNames.join(", ") : `${effectiveNames.slice(0, 2).join(", ")} + ${effectiveNames.length - 2} more`;
}

function renderPermissionCapability(policy: GuildCapabilityPolicySet["capabilities"][number], ranks: GuildCapabilityPolicySet["ranks"]): string {
  const checkboxes = ranks.filter((rank) => rank.active && rank.rankIndex !== 0).map((rank) => `<label class="permission-rank-option"><input type="checkbox" value="${rank.rankIndex}"${policy.permittedRanks.includes(rank.rankIndex) ? " checked" : ""}><span><strong>${htmlText(rank.displayName)}</strong><small>Rank ${rank.rankIndex}</small></span></label>`).join("\n");
  return `<article class="permission-capability" data-permission-capability="${htmlText(policy.key)}"><details><summary><span class="permission-capability-copy"><strong>${htmlText(policy.label)}</strong>${policy.description ? `<small>${htmlText(policy.description)}</small>` : ""}</span><span class="permission-capability-summary" data-permission-summary>${htmlText(rankSummary(policy, ranks))}</span></summary><form class="permission-capability-editor" data-permission-form><p class="permission-inherent-authority"><strong>Guild Master</strong> · Rank 0 · inherent</p><div class="permission-rank-options">${checkboxes}</div><div class="permission-capability-actions"><button type="submit" class="button-primary">Save</button><p data-permission-status role="status" aria-live="polite"></p></div></form></details></article>`;
}

function renderPermissionPolicies(policies: GuildCapabilityPolicySet): string {
  const groups = new Map<string, { label: string; capabilities: GuildCapabilityPolicySet["capabilities"] }>();
  for (const capability of policies.capabilities) {
    const group = groups.get(capability.namespace) ?? { label: capability.namespaceLabel, capabilities: [] };
    group.capabilities.push(capability);
    groups.set(capability.namespace, group);
  }
  const index = [...groups.entries()].map(([namespace, group]) => `<a href="#permissions-${htmlText(namespace)}">${htmlText(group.label)}</a>`).join("");
  const sections = [...groups.entries()].map(([namespace, group]) => `<section id="permissions-${htmlText(namespace)}" class="permission-namespace"><h2>${htmlText(group.label)}</h2><div class="permission-capabilities">${group.capabilities.map((capability) => renderPermissionCapability(capability, policies.ranks)).join("\n")}</div></section>`).join("\n");
  return `<nav class="permission-index" aria-label="Permission groups">${index}</nav><div class="permission-namespaces">${sections}</div>`;
}

export async function registerAdminPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/admin", async (_request, reply) => reply.redirect("/admin/general"));

  app.get("/admin/general", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([viewerForRequest(sessionToken), authenticatedGuildie(sessionToken)]);
    if (!guildie) return reply.code(401).send("Authentication is required.");

    const [canConfigureGuildRefreshSchedule, canConfigureTheme, canConfigureGuildPresentation, canRefresh] = await Promise.all([
      guildieHasGuildCapability(guildie.guildieId, GUILD_REFRESH_SCHEDULE_CONFIGURE_CAPABILITY),
      guildieHasGuildCapability(guildie.guildieId, THEME_CONFIGURE_CAPABILITY),
      guildieHasGuildCapability(guildie.guildieId, GUILD_PRESENTATION_CONFIGURE_CAPABILITY),
      guildieHasGuildCapability(guildie.guildieId, GUILD_REFRESH_CAPABILITY),
    ]);
    const [refreshSchedule, theme, presentation, refreshStatus] = await Promise.all([
      guildRefreshSchedule(),
      guildTheme(),
      guildPresentation(),
      guildRefreshStatus(),
    ]);

    const themeSettings = administrationSection("appearance", "appearance-heading", "Appearance", renderThemeSettings(theme).replaceAll("<select data-theme-select>", `<select data-theme-select${canConfigureTheme ? "" : " disabled"}>`).replaceAll("<button type=\"submit\" class=\"button-primary\" data-theme-save>", `<button type="submit" class="button-primary" data-theme-save${canConfigureTheme ? "" : " disabled"}>`));
    const presentationSettings = administrationSection("guild-presentation", "guild-presentation-heading", "Guild presentation", canConfigureGuildPresentation ? renderGuildPresentationSettings(presentation) : renderGuildPresentationSettings(presentation).replaceAll("<input ", "<input disabled ").replaceAll("<button type=\"submit\"", "<button disabled type=\"submit\""));
    const schedule = canConfigureGuildRefreshSchedule ? renderGuildRefreshSchedule(refreshSchedule) : renderGuildRefreshSchedule(refreshSchedule).replaceAll("<input ", "<input disabled ").replaceAll("<button type=\"submit\"", "<button disabled type=\"submit\"");
    const guildSettings = administrationSection("guild-settings", "guild-settings-heading", "Guild synchronization", `${schedule}${renderGuildRefreshOperation(refreshStatus, canRefresh)}`);
    const content = `<div class="admin-sections">${themeSettings}${presentationSettings}${guildSettings}</div>`;

    const html = renderPage(assets, { pathname: "/admin/general", title: `General Settings · ${viewer.guildPresentation.guildName} Guild Operations`, description: "Inspect and configure Guild Operations.", viewer, stylesheets: ["admin.css"], scripts: ["admin.js", "operations.js"], header: `<div class="admin-page-header"><h1 id="page-title">Settings</h1><p class="lede">Inspect and manage Guild Operations according to your authority.</p></div>`, body: `${content}` });
    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  });

  app.get("/admin/modules", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([viewerForRequest(sessionToken), authenticatedGuildie(sessionToken)]);
    if (!guildie) return reply.code(401).send("Authentication is required.");
    const [canConfigureModules, administration, modulesState] = await Promise.all([
      guildieHasGuildCapabilityOrOperator(guildie.guildieId, MODULES_CONFIGURE_CAPABILITY),
      administrationAvailabilityForGuildie(guildie.guildieId),
      packagedCapabilityStates(),
    ]);
    let lifecycle = renderPackagedCapabilityLifecycle(modulesState, administration.canConfigureDiscord);
    if (!canConfigureModules) lifecycle = lifecycle.replaceAll("<input type=\"checkbox\" data-module-enabled", "<input type=\"checkbox\" data-module-enabled disabled");
    const content = administrationSection("modules", "modules-heading", "Packaged capabilities", `${lifecycle}<p class="admin-section-note">Availability and entitlement are distinct from enablement. Controls are available only when your authority permits changes.</p>`);
    const html = renderPage(assets, { pathname: "/admin/modules", title: `Module Settings · ${viewer.guildPresentation.guildName} Guild Operations`, description: "Inspect and configure packaged Guild Operations capabilities.", viewer, stylesheets: ["admin.css", "admin-modules.css"], scripts: canConfigureModules ? ["admin-modules.js"] : [], header: `<div class="admin-page-header"><h1 id="page-title">Settings</h1><p class="lede">Inspect and manage packaged Modules and Plugins.</p></div>`, body: `<div class="admin-sections">${content}</div>` });
    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  });

  app.put("/admin/modules/:moduleKey", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "authentication_required" });
    if (!await guildieHasGuildCapabilityOrOperator(guildie.guildieId, MODULES_CONFIGURE_CAPABILITY)) return reply.code(403).send({ error: "module_configuration_not_authorized" });
    const params = request.params as { moduleKey?: unknown };
    const body = (request.body ?? {}) as { enabled?: unknown };
    if (typeof params.moduleKey !== "string" || !isPackagedCapabilityKey(params.moduleKey)) return reply.code(404).send({ error: "unknown_module" });
    if (typeof body.enabled !== "boolean") return reply.code(400).send({ error: "enabled_must_be_boolean" });
    return reply.send({ module: await setPackagedCapabilityEnabled(params.moduleKey, body.enabled) });
  });


  app.put("/admin/general/theme", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "authentication_required" });
    if (!await guildieHasGuildCapability(guildie.guildieId, THEME_CONFIGURE_CAPABILITY)) return reply.code(403).send({ error: "theme_configuration_not_authorized" });
    const body = (request.body ?? {}) as { theme?: unknown };
    if (typeof body.theme !== "string" || !isGuildThemeKey(body.theme)) return reply.code(400).send({ error: "unknown_theme" });
    return reply.send({ theme: await setGuildTheme(body.theme) });
  });

  app.put("/admin/general/presentation", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "authentication_required" });
    if (!await guildieHasGuildCapability(guildie.guildieId, GUILD_PRESENTATION_CONFIGURE_CAPABILITY)) return reply.code(403).send({ error: "guild_presentation_configuration_not_authorized" });
    const body = (request.body ?? {}) as { raiderIoUrl?: unknown; warcraftLogsUrl?: unknown };
    const raiderIoUrl = parseGuildPresentationUrl(body.raiderIoUrl ?? null);
    const warcraftLogsUrl = parseGuildPresentationUrl(body.warcraftLogsUrl ?? null);
    if (raiderIoUrl === undefined || warcraftLogsUrl === undefined) return reply.code(400).send({ error: "presentation_urls_must_use_http_or_https" });
    return reply.send({ presentation: await setGuildPresentationDestinations({ raiderIoUrl, warcraftLogsUrl }) });
  });

  app.get("/admin/permissions", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([viewerForRequest(sessionToken), authenticatedGuildie(sessionToken)]);
    const authorized = guildie ? await canAdministerGuildPermissions(guildie.guildieId) : false;
    const policies = authorized && guildie ? await guildCapabilityPoliciesForActor(guildie.guildieId) : null;
    const developmentAuthority = guildie ? hasDevelopmentGuildMasterAuthority(guildie.guildieId) : false;
    const content = authorized && policies ? `<section class="permission-administration" aria-labelledby="permission-heading"><div class="permission-intro"><h2 id="permission-heading">Capability access</h2><p>Choose which current Blizzard guild ranks receive each Guild Operations capability in addition to Guild Master rank 0. Rank 0 and the development authority override are inherently capable and are not configurable here.</p>${developmentAuthority ? `<p class="permission-operator-notice"><strong>Development authority override active.</strong> This access is independent of your current guild rank.</p>` : ""}</div>${renderPermissionPolicies(policies)}</section>` : `<section class="admin-unavailable" aria-labelledby="admin-unavailable-heading"><h2 id="admin-unavailable-heading">Permission administration is not available for this account.</h2></section>`;
    const html = renderPage(assets, { pathname: "/admin/permissions", title: `Permissions Settings · ${viewer.guildPresentation.guildName} Guild Operations`, description: "Configure Guild Operations permission policy.", viewer, stylesheets: ["admin.css", "admin-permissions.css"], scripts: ["admin-permissions.js"], header: `<div class="admin-page-header"><h1 id="page-title">Settings</h1><p class="lede">Configure who may use Guild Operations capabilities.</p></div>`, body: `${content}` });
    if (!authorized) return reply.code(guildie ? 403 : 401).header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  });

  app.put("/admin/permissions/:capability", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "authentication_required" });
    const params = request.params as { capability?: unknown };
    const body = (request.body ?? {}) as { permittedRanks?: unknown };
    if (typeof params.capability !== "string") return reply.code(400).send({ error: "capability_required" });
    if (!Array.isArray(body.permittedRanks) || !body.permittedRanks.every(Number.isInteger)) return reply.code(400).send({ error: "permitted_ranks_must_be_integer_array" });
    try {
      const permittedRanks = await setGuildCapabilityPermittedRanks(guildie.guildieId, params.capability, body.permittedRanks as number[]);
      return reply.send({ capability: params.capability, permittedRanks });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Guild permission could not be updated";
      const statusCode = message.includes("cannot administer") ? 403 : message.includes("Unknown configurable") ? 404 : 400;
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/admin/permissions/raid", async (_request, reply) => reply.redirect("/admin/permissions#permissions-raid"));
  app.get("/admin/raid/permissions", async (_request, reply) => reply.redirect("/admin/permissions#permissions-raid"));
}
