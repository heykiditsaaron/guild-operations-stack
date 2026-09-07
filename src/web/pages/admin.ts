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
  OPERATIONS_INSPECT_CAPABILITY,
  guildieHasGuildCapability,
} from "../../guild-permissions.js";
import { raffleGuildieCanAdminister } from "../../modules/raffle/authorization.js";
import type { AssetRegistry } from "../assets.js";
import { renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

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
      <button type="button" class="guild-refresh-button" data-guild-refresh-button>Refresh now</button>
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
        <label class="guild-refresh-toggle">
          <input type="checkbox" data-guild-refresh-schedule-enabled${schedule.enabled ? " checked" : ""}>
          <span>${schedule.enabled ? "On" : "Off"}</span>
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
        <button type="submit" data-guild-refresh-schedule-save>Save</button>
      </div>
      <div class="guild-refresh-schedule-next">
        <span>Next automatic refresh</span>
        <strong data-guild-refresh-schedule-next>${nextAutomaticRefresh}</strong>
      </div>
      <p class="guild-refresh-schedule-feedback" data-guild-refresh-schedule-feedback role="status" aria-live="polite"></p>
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
    const [canRefreshGuild, canInspectOperations, canAdministerRaffle] = guildie
      ? await Promise.all([
          guildieHasGuildCapability(guildie.guildieId, GUILD_REFRESH_CAPABILITY),
          guildieHasGuildCapability(guildie.guildieId, OPERATIONS_INSPECT_CAPABILITY),
          raffleGuildieCanAdminister(guildie.guildieId),
        ])
      : [false, false, false];

    const [refreshStatus, refreshSchedule] = await Promise.all([
      canRefreshGuild ? guildRefreshStatus() : Promise.resolve(null),
      canRefreshGuild ? guildRefreshSchedule() : Promise.resolve(null),
    ]);

    const availableAdministration: string[] = [];

    if (canAdministerRaffle) {
      availableAdministration.push(destination(
        "Raffle",
        "Create and operate guild raffles.",
        "/admin/raffle",
      ));
    }

    const hasAdministration = canRefreshGuild || canInspectOperations || availableAdministration.length > 0;
    const guildSettings = canRefreshGuild && refreshSchedule
      ? administrationSection(
          "guild-settings",
          "guild-settings-heading",
          "Guild settings",
          renderGuildRefresh(refreshStatus, refreshSchedule),
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
}
