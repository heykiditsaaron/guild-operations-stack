import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { guildRefreshStatus } from "../../guild-admin.js";
import {
  GUILD_REFRESH_CAPABILITY,
  OPERATIONS_INSPECT_CAPABILITY,
  guildieHasGuildCapability,
} from "../../guild-permissions.js";
import {
  listOperationalRecords,
  type OperationalRecord,
  type OperationalRecordKind,
} from "../../operational-inspection.js";
import type { AssetRegistry } from "../assets.js";
import { renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderDetails(details: Record<string, unknown> | null): string {
  if (!details) return "";
  const serialized = JSON.stringify(details, null, 2);
  return `<details class="operations-record-details">
    <summary>Details</summary>
    <pre>${escapeHtml(serialized)}</pre>
  </details>`;
}

function renderRecord(record: OperationalRecord): string {
  const result = record.result
    ? `<span class="operations-record-result operations-record-result-${record.result}">${escapeHtml(record.result)}</span>`
    : "";
  const actor = record.actorGuildieId
    ? `<span class="operations-record-actor">Actor: ${escapeHtml(record.actorGuildieId)}</span>`
    : "";

  return `<article class="operations-record">
    <div class="operations-record-heading">
      <time data-unix-time="${record.occurredAtUnix}">${record.occurredAtUnix}</time>
      <span class="operations-record-source">${escapeHtml(record.source)}</span>
      <span aria-hidden="true">·</span>
      <span class="operations-record-operation">${escapeHtml(record.operation)}</span>
      <span class="operations-record-kind">${escapeHtml(record.kind)}</span>
      ${result}
    </div>
    <p class="operations-record-summary">${escapeHtml(record.summary)}</p>
    ${actor}
    ${renderDetails(record.details)}
  </article>`;
}

function normalizedKind(value: string | undefined): OperationalRecordKind | undefined {
  if (value === "result" || value === "exception") return value;
  return undefined;
}

function renderGuildRefresh(status: Awaited<ReturnType<typeof guildRefreshStatus>>): string {
  const memberCount = status
    ? status.currentMemberCount.toLocaleString("en-US")
    : "—";
  const lastReconciled = status
    ? `<time data-unix-time="${status.lastReconciledAtUnix}">${status.lastReconciledAtUnix}</time>`
    : "Not yet observed";

  return `<section class="admin-section" aria-labelledby="guild-refresh-operation-heading">
    <div class="guild-refresh-admin" data-guild-refresh-admin>
      <div class="guild-refresh-admin-heading">
        <div>
          <h2 id="guild-refresh-operation-heading">Guild refresh</h2>
          <p>Reconcile current guild membership and rank authority from Blizzard now.</p>
        </div>
        <button type="button" class="guild-refresh-button button-primary" data-guild-refresh-button>Refresh now</button>
      </div>
      <div class="guild-refresh-status">
        <div class="guild-refresh-stat"><strong>${memberCount}</strong><span>current members</span></div>
        <div class="guild-refresh-stat"><span>Last reconciled</span><strong>${lastReconciled}</strong></div>
      </div>
      <p class="guild-refresh-feedback" data-guild-refresh-feedback role="status" aria-live="polite"></p>
    </div>
  </section>`;
}

function renderInspection(
  records: OperationalRecord[],
  source: string | undefined,
  kind: OperationalRecordKind | undefined,
): string {
  const filters = `<form class="operations-filters" method="get" action="/admin/history">
    <label>
      <span>Source</span>
      <input type="text" name="source" value="${escapeHtml(source ?? "")}" placeholder="Any source">
    </label>
    <label>
      <span>Kind</span>
      <select name="kind">
        <option value=""${kind === undefined ? " selected" : ""}>Any kind</option>
        <option value="result"${kind === "result" ? " selected" : ""}>Result</option>
        <option value="exception"${kind === "exception" ? " selected" : ""}>Exception</option>
      </select>
    </label>
    <button type="submit">Apply</button>
    ${(source || kind) ? '<a href="/admin/history">Clear</a>' : ""}
  </form>`;

  return `<section class="operations-inspection admin-section" aria-labelledby="operations-records-heading">
    <h2 id="operations-records-heading">Operational history</h2>
    <p class="admin-section-note">Review recorded operational results and exceptions.</p>
    ${filters}
    <div class="operations-records-heading">
      <h3>Recent records</h3>
      <span>${records.length} shown</span>
    </div>
    <div class="operations-records">
      ${records.length
        ? records.map(renderRecord).join("\n")
        : '<p class="operations-empty">No operational records match this view.</p>'}
    </div>
  </section>`;
}

export async function registerOperationsAdminPage(
  app: FastifyInstance,
  assets: AssetRegistry,
): Promise<void> {
  app.get("/admin/operations", async (_request, reply) => reply.redirect("/admin/history"));

  app.get("/operations", async (_request, reply) => reply.redirect("/admin/history"));

  app.get("/admin/history", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
    ]);

    const canInspect = guildie ? await guildieHasGuildCapability(guildie.guildieId, OPERATIONS_INSPECT_CAPABILITY) : false;

    const query = request.query as { source?: string; kind?: string };
    const source = query.source?.trim() || undefined;
    const kind = normalizedKind(query.kind);
    const records = canInspect ? await listOperationalRecords({ source, kind, limit: 100 }) : [];

    const sections = canInspect ? renderInspection(records, source, kind) : "";

    const body = sections
      ? `<div class="admin-sections">${sections}</div>`
      : `<section class="admin-unavailable"><h2>History is not available for this account.</h2></section>`;

    const html = renderPage(assets, {
      pathname: "/admin/history",
      title: `History · ${viewer.guildPresentation.guildName} Guild Operations`,
      description: "Inspect recorded Guild Operations history.",
      viewer,
      stylesheets: ["admin.css"],
      scripts: ["operations.js"],
      header: `
        <div class="admin-page-header">
          <h1 id="page-title">Settings</h1>
          <p class="lede">Inspect recorded Guild Operations outcomes.</p>
        </div>`,
      body: `<nav class="admin-tabs" aria-label="Settings sections"><a href="/admin/general">General</a><a href="/admin/modules">Modules</a><a href="/admin/permissions">Permissions</a><a href="/admin/history" aria-current="page">History</a></nav>${body}`,
    });

    const available = canInspect;
    const statusCode = !guildie ? 401 : available ? 200 : 403;
    return reply
      .code(statusCode)
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
