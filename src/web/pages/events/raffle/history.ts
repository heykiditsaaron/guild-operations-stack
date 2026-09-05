import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../../../auth.js";
import { raffleHistory, type RaffleHistoryRound } from "../../../../modules/raffle/history-view.js";
import type { AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

function localTime(unixSeconds: number): string {
  const instant = new Date(unixSeconds * 1000).toISOString();
  return `<time datetime="${instant}" data-local-time-unix="${unixSeconds}" data-local-time-date-style="medium">${instant}</time>`;
}

function formatGold(value: bigint | string): string {
  return BigInt(value).toLocaleString("en-US");
}

function statusLabel(round: RaffleHistoryRound): string {
  if (round.conclusion === "drawn") return "Drawn";
  if (round.conclusion === "operator_cancelled") return "Cancelled";
  if (round.conclusion === "no_participation") return "No participation";
  return "Concluded";
}

function historicalValues(round: RaffleHistoryRound): { entries: number; pot: bigint; prize: bigint | null } {
  const entries = round.totalEntries ?? round.approvedTicketCount;
  const pot = BigInt(round.ticketPriceGold) * BigInt(entries);
  const prize = round.conclusion === "drawn"
    && round.prizeKind === "gold"
    && round.winnerPercentage !== null
      ? (pot * BigInt(round.winnerPercentage)) / 100n
      : null;

  return { entries, pot, prize };
}

function historyFact(label: string, value: string): string {
  return `<div class="raffle-history-fact"><dt>${htmlText(label)}</dt><dd>${value}</dd></div>`;
}

function historyEntry(round: RaffleHistoryRound): string {
  const { entries, pot, prize } = historicalValues(round);
  const concluded = round.concludedAtUnix === null ? "Unknown" : localTime(round.concludedAtUnix);
  const winner = round.conclusion === "drawn" && round.winnerCharacterName
    ? historyFact("Winner", htmlText(round.winnerCharacterName))
    : "";
  const prizeRow = prize !== null
    ? historyFact("Prize", `${formatGold(prize)} gold`)
    : "";
  const potLabel = round.conclusion === "drawn" ? "Final pot" : "Confirmed gold at closure";
  const entryLabel = round.conclusion === "drawn" ? "Final entries" : "Approved tickets at closure";

  return `
    <li class="raffle-history-item">
      <div class="raffle-history-heading">
        <strong>${htmlText(statusLabel(round))}</strong>
        <span>${concluded}</span>
      </div>
      <dl class="raffle-history-facts">
        ${winner}
        ${historyFact(entryLabel, entries.toLocaleString("en-US"))}
        ${historyFact(potLabel, `${formatGold(pot)} gold`)}
        ${prizeRow}
        ${historyFact("Ticket price", `${formatGold(round.ticketPriceGold)} gold`)}
      </dl>
    </li>`;
}

function historyBody(rounds: RaffleHistoryRound[]): string {
  if (rounds.length === 0) {
    return `
      <section class="raffle-reference-page raffle-reference-empty" aria-labelledby="raffle-history-empty-title">
        <h2 id="raffle-history-empty-title">No previous raffles yet.</h2>
        <p>Concluded raffle rounds will be preserved here.</p>
      </section>`;
  }

  return `
    <section class="raffle-reference-page" aria-label="Previous raffle rounds">
      <ol class="raffle-history-list">
        ${rounds.map(historyEntry).join("\n")}
      </ol>
    </section>`;
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
      title: "Previous Raffles · OH CRIT I Pulled! Guild Operations",
      description: "Completed OH CRIT I Pulled! guild raffle rounds.",
      viewer,
      secondaryNavigation: {
        kind: "breadcrumb",
        items: [
          { label: "Events" },
          { label: "Raffle", href: "/events/raffle" },
          { label: "Previous Raffles" },
        ],
      },
      stylesheets: ["raffle.css"],
      header: `
        <div class="raffle-page-header">
          <p class="eyebrow">Events · Raffle</p>
          <h1 id="page-title">Previous Raffles</h1>
          <p class="lede">Concluded raffles, preserved as guild history.</p>
        </div>`,
      body: historyBody(rounds),
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
