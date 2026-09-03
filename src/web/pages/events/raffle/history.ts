import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../../../auth.js";
import { raffleHistory, type RaffleHistoryRound } from "../../../../raffle/history-view.js";
import { htmlText, renderPage } from "../../../render.js";
import type { AssetRegistry } from "../../../assets.js";
import { viewerForRequest } from "../../../viewer.js";

function localTime(date: Date): string {
  const unixSeconds = Math.floor(date.getTime() / 1000);
  const instant = date.toISOString();
  return `<time datetime="${instant}" data-local-time-unix="${unixSeconds}" data-local-time-date-style="medium">${instant}</time>`;
}

function formatGold(value: bigint | string): string {
  return BigInt(value).toLocaleString("en-US");
}

function statusLabel(status: RaffleHistoryRound["status"]): string {
  if (status === "drawn") return "Drawn";
  if (status === "admin_cancelled") return "Cancelled";
  if (status === "no_entry_cancelled") return "Cancelled · no entries";
  return status;
}

function historicalValues(round: RaffleHistoryRound): { entries: number; pot: bigint; prize: bigint | null } {
  const entries = round.totalEntries ?? round.approvedTicketCount;
  const pot = BigInt(round.ticketPriceGold) * BigInt(entries);
  const prize = round.status === "drawn"
    && round.prizeKind === "gold"
    && round.winnerPercentage !== null
      ? (pot * BigInt(round.winnerPercentage)) / 100n
      : null;

  return { entries, pot, prize };
}

function historyEntry(round: RaffleHistoryRound): string {
  const { entries, pot, prize } = historicalValues(round);
  const concluded = round.concludedAt ? localTime(round.concludedAt) : "Unknown";
  const winner = round.status === "drawn" && round.winnerCharacterName
    ? `<dt style="color: #aaa69c;">Winner</dt><dd style="margin: 0; font-weight: 700;">${htmlText(round.winnerCharacterName)}</dd>`
    : "";
  const prizeRow = prize !== null
    ? `<dt style="color: #aaa69c;">Prize</dt><dd style="margin: 0; font-weight: 700;">${formatGold(prize)} gold</dd>`
    : "";
  const potLabel = round.status === "drawn" ? "Final pot" : "Confirmed gold at closure";
  const entryLabel = round.status === "drawn" ? "Final entries" : "Approved tickets at closure";

  return `
    <li style="padding: 1.5rem 0 1.75rem; border-bottom: 1px solid rgba(238,201,124,0.18);">
      <div style="display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; flex-wrap: wrap; margin-bottom: 1.25rem;">
        <strong style="font-size: 1.2rem;">${htmlText(statusLabel(round.status))}</strong>
        <span style="color: #aaa69c; font-size: 0.9rem;">${concluded}</span>
      </div>
      <dl style="display: grid; grid-template-columns: minmax(9rem, 0.9fr) minmax(0, 1.1fr); gap: 0.7rem 1.25rem; margin: 0;">
        ${winner}
        <dt style="color: #aaa69c;">${entryLabel}</dt>
        <dd style="margin: 0; font-weight: 700;">${entries.toLocaleString("en-US")}</dd>
        <dt style="color: #aaa69c;">${potLabel}</dt>
        <dd style="margin: 0; font-weight: 700;">${formatGold(pot)} gold</dd>
        ${prizeRow}
        <dt style="color: #aaa69c;">Ticket price</dt>
        <dd style="margin: 0; font-weight: 700;">${formatGold(round.ticketPriceGold)} gold</dd>
      </dl>
    </li>`;
}

function historyBody(rounds: RaffleHistoryRound[]): string {
  if (rounds.length === 0) {
    return `
      <div style="width: min(100%, 46rem); border-top: 1px solid rgba(238,201,124,0.18); padding-top: 2rem;">
        <h2>No completed raffles yet.</h2>
        <p class="lede">Concluded and cancelled raffle rounds will be preserved here.</p>
      </div>`;
  }

  return `
    <div style="width: min(100%, 46rem);">
      <ol style="list-style: none; margin: 0; padding: 0; border-top: 1px solid rgba(238,201,124,0.18);">
        ${rounds.map(historyEntry).join("\n")}
      </ol>
    </div>`;
}

export async function registerRaffleHistoryPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/events/raffle/history", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, rounds] = await Promise.all([
      viewerForRequest(sessionToken),
      raffleHistory(),
    ]);

    const html = renderPage(assets, {
      pathname: "/events/raffle/history",
      title: "Raffle History · OH CRIT I Pulled! Guild Operations",
      description: "Completed OH CRIT I Pulled! guild raffle rounds.",
      viewer,
      header: `
        <div style="margin-top: calc(-1 * clamp(2rem, 8vw, 5.5rem)); margin-bottom: clamp(2rem, 6vw, 3rem); font-size: 0.88rem;">
          <a href="/events/raffle" style="color: #c9c5ba;">Current raffle</a>
        </div>
        <div class="home-header-copy">
          <p class="eyebrow">Events · Raffle</p>
          <h1 id="page-title">Raffle History</h1>
          <p class="lede">The preserved ledger of completed and cancelled guild raffle rounds.</p>
        </div>`,
      body: historyBody(rounds),
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
