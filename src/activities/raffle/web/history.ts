import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../../auth.js";
import { activityRecords, type ActivityRecord } from "../../../core/activity/records.js";
import type { ActivityOccurrenceAttribute } from "../../../core/activity/registry.js";
import type { AssetRegistry } from "../../../web/assets.js";
import { renderActivityOccurrenceSharedValues } from "../../../web/activity-values.js";
import { htmlText, renderPage } from "../../../web/render.js";
import { viewerForRequest } from "../../../web/viewer.js";

function localTime(unixSeconds: number): string {
  const instant = new Date(unixSeconds * 1000).toISOString();
  return `<time datetime="${instant}" data-local-time-unix="${unixSeconds}" data-local-time-date-style="medium">${instant}</time>`;
}

function attribute(record: ActivityRecord, kind: string): ActivityOccurrenceAttribute | null {
  return record.occurrence.attributes.find((candidate) => candidate.kind === kind) ?? null;
}

function stringAttribute(record: ActivityRecord, kind: string): string | null {
  const value = attribute(record, kind)?.value;
  if (!value || Array.isArray(value) || value.type !== "string") return null;
  return value.value;
}

function integerAttribute(record: ActivityRecord, kind: string): number | null {
  const value = attribute(record, kind)?.value;
  if (!value || Array.isArray(value) || value.type !== "integer") return null;
  return value.value;
}

function status(record: ActivityRecord): string {
  const conclusion = stringAttribute(record, "conclusion");
  if (conclusion === "drawn") return "Drawn";
  if (conclusion === "operator_cancelled") return "Cancelled";
  if (conclusion === "no_participation") return "No participation";
  return "Concluded";
}

async function entry(record: ActivityRecord): Promise<string> {
  const approvedEntries = integerAttribute(record, "approved_entries");
  const winner = attribute(record, "winner");
  const winnerSummary = winner
    ? `<span>Winner: <strong>${await renderActivityOccurrenceSharedValues(record.occurrence, winner.value)}</strong></span>`
    : "";
  const entriesSummary = approvedEntries === null
    ? ""
    : `<span>${approvedEntries} approved ${approvedEntries === 1 ? "entry" : "entries"}</span>`;

  return `<li class="raffle-history-item"><a class="raffle-history-record-link" href="/activities/raffle/${encodeURIComponent(record.activityId)}"><div class="raffle-history-heading"><div><strong>${htmlText(record.occurrence.title)}</strong><span class="raffle-history-status">${htmlText(status(record))}</span></div><span>${localTime(record.frozenAtUnix)}</span></div><div class="raffle-history-summary">${winnerSummary}${entriesSummary}<span class="raffle-reference-arrow">Inspect raffle →</span></div></a></li>`;
}

async function body(records: readonly ActivityRecord[]): Promise<string> {
  if (!records.length) {
    return '<section class="raffle-reference-page raffle-reference-empty"><h2>No previous raffles yet.</h2><p>Concluded raffles will be preserved here.</p></section>';
  }
  const entries = await Promise.all(records.map(entry));
  return `<section class="raffle-reference-page" aria-label="Previous raffles"><ol class="raffle-history-list">${entries.join("\n")}</ol></section>`;
}

export async function registerRaffleHistoryPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/activities/raffle/history", async (request, reply) => {
    const [viewer, records] = await Promise.all([
      viewerForRequest(request.cookies[SESSION_COOKIE_NAME]),
      activityRecords("raffle"),
    ]);
    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(renderPage(assets, {
      pathname: "/activities/raffle/history",
      title: `Previous Raffles · ${viewer.guildPresentation.guildName}`,
      description: `Previous ${viewer.guildPresentation.guildName} guild raffles.`,
      viewer,
      secondaryNavigation: { kind: "breadcrumb", items: [{ label: "Activities", href: "/activities" }, { label: "Raffle", href: "/activities/raffle" }, { label: "Previous Raffles" }] },
      stylesheets: ["raffle.css", "raffle-round.css"],
      header: '<div class="raffle-page-header"><p class="eyebrow">Activities · Raffle</p><h1 id="page-title">Previous Raffles</h1><p class="lede">Concluded raffles, preserved for inspection.</p></div>',
      body: await body(records),
    }));
  });
}
