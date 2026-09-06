import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import {
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
      <time datetime="${record.occurredAtUnix}" data-unix-time="${record.occurredAtUnix}">${record.occurredAtUnix}</time>
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

export async function registerOperationsAdminPage(
  app: FastifyInstance,
  assets: AssetRegistry,
): Promise<void> {
  app.get("/admin/operations", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
    ]);

    const canInspect = guildie
      ? await guildieHasGuildCapability(guildie.guildieId, OPERATIONS_INSPECT_CAPABILITY)
      : false;

    const query = request.query as { source?: string; kind?: string };
    const source = query.source?.trim() || undefined;
    const kind = normalizedKind(query.kind);
    const records = canInspect
      ? await listOperationalRecords({ source, kind, limit: 100 })
      : [];

    const filters = `<form class="operations-filters" method="get" action="/admin/operations">
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
      ${(source || kind) ? '<a href="/admin/operations">Clear</a>' : ""}
    </form>`;

    const body = canInspect
      ? `<section class="operations-inspection" aria-labelledby="operations-records-heading">
          ${filters}
          <div class="operations-records-heading">
            <h2 id="operations-records-heading">Recent records</h2>
            <span>${records.length} shown</span>
          </div>
          <div class="operations-records">
            ${records.length
              ? records.map(renderRecord).join("\n")
              : '<p class="operations-empty">No operational records match this view.</p>'}
          </div>
        </section>`
      : `<section class="admin-unavailable">
          <h2>Operational inspection is not available for this account.</h2>
        </section>`;

    const html = renderPage(assets, {
      pathname: "/admin/operations",
      title: "Operations · OH CRIT I Pulled!",
      description: "Administrative operational inspection.",
      viewer,
      stylesheets: ["admin.css"],
      secondaryNavigation: {
        kind: "breadcrumb",
        items: [
          { label: "Administration", href: "/admin" },
          { label: "Operations" },
        ],
      },
      header: `
        <div class="admin-page-header">
          <h1 id="page-title">Operations</h1>
          <p class="lede">Review operational results and exceptions published for administrative inspection.</p>
        </div>`,
      body,
    });

    const statusCode = !guildie ? 401 : canInspect ? 200 : 403;
    return reply
      .code(statusCode)
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
