import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../../../auth.js";
import { raffleClaimCutoffUnix, raffleClaimsAreOpen } from "../../../../raffle/domain.js";
import {
  activeRaffleRoundOverview,
  type ActiveRaffleRoundOverview,
} from "../../../../raffle/live-round.js";
import { assetUrl, type AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

function localTime(unixSeconds: number): string {
  const instant = new Date(unixSeconds * 1000).toISOString();
  return `<time datetime="${instant}" data-local-time-unix="${unixSeconds}" data-local-time-date-style="full">${instant}</time>`;
}

function formatGold(value: bigint | string): string {
  return BigInt(value).toLocaleString("en-US");
}

function goldPrize(round: ActiveRaffleRoundOverview): bigint | null {
  if (round.prizeKind !== "gold" || round.winnerPercentage === null) return null;
  const pot = BigInt(round.ticketPriceGold) * BigInt(round.approvedTicketCount);
  return (pot * BigInt(round.winnerPercentage)) / 100n;
}

function activeRaffleBody(round: ActiveRaffleRoundOverview, assets: AssetRegistry): string {
  const cutoffUnix = raffleClaimCutoffUnix(round.drawingAtUnix);
  const claimsOpen = raffleClaimsAreOpen(round.drawingAtUnix);
  const prize = goldPrize(round);
  const prizeValue = prize === null
    ? htmlText(round.prizeKind)
    : `${formatGold(prize)} gold`;

  return `
    <div class="raffle-public-shell">
      <div class="raffle-plaque-wrap">
        <section class="raffle-plaque" aria-labelledby="raffle-live-title">
          <img class="raffle-plaque-art" src="${assetUrl(assets, "images/raffle/gold-sack.png")}" alt="" aria-hidden="true">
          <div class="raffle-plaque-copy">
            <p class="raffle-live-kicker" id="raffle-live-title">Raffle is live</p>

            <div class="raffle-countdown-block" data-raffle-countdown-block data-raffle-closed="${claimsOpen ? "false" : "true"}">
              <span class="raffle-countdown" data-raffle-cutoff-unix="${cutoffUnix}">${claimsOpen ? "--:--:--" : "Entries closed"}</span>
              <span class="raffle-countdown-caption" data-raffle-countdown-caption>${claimsOpen ? "until entries close" : "Awaiting the officer-run drawing"}</span>
            </div>

            <div class="raffle-stats">
              <div class="raffle-stat">
                <span class="raffle-plaque-label">Entries</span>
                <strong class="raffle-stat-value">${round.approvedTicketCount.toLocaleString("en-US")}</strong>
              </div>
              <div class="raffle-stat">
                <span class="raffle-plaque-label">Current prize</span>
                <strong class="raffle-stat-value">${prizeValue}</strong>
              </div>
            </div>

            <div class="raffle-drawing">
              <p class="raffle-plaque-label">Estimated drawing time</p>
              ${localTime(round.drawingAtUnix)}
            </div>

            <div class="raffle-actions" aria-label="Raffle actions">
              ${claimsOpen ? '<a class="raffle-action" data-raffle-entry-action href="/events/raffle/enter">Enter to win</a>' : ""}
              <a class="raffle-action raffle-action-secondary" href="/events/raffle/claims">View claims</a>
            </div>
          </div>
        </section>
      </div>

      <nav class="raffle-reference-links" aria-label="Raffle information">
        <a class="raffle-reference-link" href="/events/raffle/history"><span>Previous Raffles</span><span aria-hidden="true">→</span></a>
        <a class="raffle-reference-link" href="/events/raffle/rules"><span>Rules and Regulations</span><span aria-hidden="true">→</span></a>
      </nav>
    </div>`;
}

function noActiveRaffleBody(): string {
  return `
    <section class="raffle-empty-state" aria-labelledby="raffle-empty-title">
      <h2 id="raffle-empty-title">No active raffle.</h2>
    </section>`;
}

export async function registerRafflePage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/events/raffle", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, liveRaffle] = await Promise.all([
      viewerForRequest(sessionToken),
      activeRaffleRoundOverview(),
    ]);

    const html = renderPage(assets, {
      pathname: "/events/raffle",
      title: "Raffle · OH CRIT I Pulled! Guild Operations",
      description: "Current OH CRIT I Pulled! guild raffle information.",
      viewer,
      stylesheets: ["raffle.css"],
      scripts: liveRaffle ? ["raffle-public.js"] : undefined,
      header: `
        <div class="raffle-page-header">
          <p class="eyebrow">Events</p>
          <h1 id="page-title">Raffle</h1>
        </div>`,
      body: liveRaffle ? activeRaffleBody(liveRaffle, assets) : noActiveRaffleBody(),
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
