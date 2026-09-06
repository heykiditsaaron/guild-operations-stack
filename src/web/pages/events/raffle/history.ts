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

function statusLabel(round: RaffleHistoryRound): string {
  if (round.conclusion === "drawn") return "Drawn";
  if (round.conclusion === "operator_cancelled") return "Cancelled";
  if (round.conclusion === "no_participation") return "No participation";
  return "Concluded";
}

function historyEntry(round: RaffleHistoryRound): string {
  const concluded = round.concludedAtUnix === null ? "Conclusion time unavailable" : localTime(round.concludedAtUnix);
  const title = round.roundTitle ?? "Guild Raffle";
  const winner = round.conclusion === "drawn" && round.winnerCharacterName
    ? `<span>Winner: <strong>${htmlText(round.winnerCharacterName)}</strong></span>`
    : "";

  return `
    <li class="raffle-history-item">
      <a class="raffle-history-record-link" href="/events/raffle/${encodeURIComponent(round.roundId)}">
        <div class="raffle-history-heading">
          <div>
            <strong>${htmlText(title)}</strong>
            <span class="raffle-history-status">${htmlText(statusLabel(round))}</span>
          </div>
          <span>${concluded}</span>
        </div>
        <div class="raffle-history-summary">
          ${winner}
          <span>${round.approvedTicketCount.toLocaleString("en-US")} approved ${round.approvedTicketCount === 1 ? "entry" : "entries"}</span>
          <span class="raffle-reference-arrow" aria-hidden="true">Inspect round →</span>
        </div>
      </a>
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
      title: "Previous Raffles · OH CRIT I Pulled!",
      description: "Previous OH CRIT I Pulled! guild raffle rounds.",
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
          <p class="lede">Concluded rounds, preserved for inspection.</p>
        </div>`,
      body: historyBody(rounds),
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
