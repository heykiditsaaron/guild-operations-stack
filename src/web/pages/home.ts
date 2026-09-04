import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../auth.js";
import { raffleClaimCutoffUnix, raffleClaimsAreOpen } from "../../raffle/domain.js";
import {
  activeRaffleRoundOverview,
  type ActiveRaffleRoundOverview,
} from "../../raffle/live-round.js";
import { assetUrl, type AssetRegistry } from "../assets.js";
import { renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

function formatGold(value: bigint | string): string {
  return BigInt(value).toLocaleString("en-US");
}

function estimatedPrize(round: ActiveRaffleRoundOverview): string {
  if (round.prizeKind !== "gold" || round.winnerPercentage === null) {
    return round.prizeKind;
  }

  const pot = BigInt(round.ticketPriceGold) * BigInt(round.approvedTicketCount);
  const prize = (pot * BigInt(round.winnerPercentage)) / 100n;
  return `${formatGold(prize)} gold`;
}

function liveRafflePromotion(round: ActiveRaffleRoundOverview, assets: AssetRegistry): string {
  const cutoffUnix = raffleClaimCutoffUnix(round.drawingAtUnix);
  const claimsOpen = raffleClaimsAreOpen(round.drawingAtUnix);
  const destination = claimsOpen ? "/events/raffle/enter" : "/events/raffle";
  const cta = claimsOpen ? "Click here to enter" : "Entries closed · View raffle";

  return `
    <a class="home-raffle-promo" href="${destination}" data-home-raffle-promo aria-labelledby="home-raffle-promo-title">
      <img class="home-raffle-promo-art" src="${assetUrl(assets, "images/raffle/gold-sack.png")}" alt="" aria-hidden="true">
      <div class="home-raffle-promo-main">
        <p class="home-raffle-promo-kicker">Guild raffle live</p>
        <h2 class="home-raffle-promo-title" id="home-raffle-promo-title">Take your shot at the pot.</h2>
        <div class="home-raffle-promo-facts">
          <div class="home-raffle-promo-fact">
            <span class="home-raffle-promo-label">Estimated prize</span>
            <strong class="home-raffle-promo-value">${estimatedPrize(round)}</strong>
          </div>
          <div class="home-raffle-promo-fact" data-raffle-countdown-block data-raffle-closed="${claimsOpen ? "false" : "true"}">
            <span class="home-raffle-promo-label">${claimsOpen ? "Entries close in" : "Entry period"}</span>
            <strong class="home-raffle-promo-value" data-raffle-cutoff-unix="${cutoffUnix}">${claimsOpen ? "--:--:--" : "Entries closed"}</strong>
            <span data-raffle-countdown-caption hidden>${claimsOpen ? "until entries close" : "Awaiting the officer-run drawing"}</span>
          </div>
        </div>
      </div>
      <span class="home-raffle-promo-cta">
        <span data-home-raffle-cta-label>${cta}</span>
        <span class="home-raffle-promo-cta-arrow" aria-hidden="true">→</span>
      </span>
    </a>`;
}

function temporaryGuildRefreshControl(authenticated: boolean): string {
  if (!authenticated) return "";

  return `
    <section class="home-panel" aria-labelledby="guild-refresh-title">
      <p class="eyebrow">Temporary operations control</p>
      <h2 id="guild-refresh-title">Guild roster refresh</h2>
      <p class="lede">Refresh Blizzard guild authority and reconcile the current roster.</p>
      <button type="button" data-refresh-guild style="min-height: 2.8rem; padding: 0.65rem 0.9rem; border: 1px solid rgba(232,201,134,0.35); border-radius: 0.65rem; background: rgba(232,201,134,0.08); color: #e8c986; font: inherit; font-weight: 700; cursor: pointer;">
        Refresh guild roster
      </button>
      <p data-guild-refresh-status aria-live="polite"></p>
    </section>`;
}

export async function registerHomePage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/", async (request, reply) => {
    const [viewer, liveRaffle] = await Promise.all([
      viewerForRequest(request.cookies[SESSION_COOKIE_NAME]),
      activeRaffleRoundOverview(),
    ]);

    const html = renderPage(assets, {
      pathname: "/",
      title: "OH CRIT I Pulled! Guild Operations",
      description: "Guild operations and community participation for OH CRIT I Pulled!",
      viewer,
      stylesheets: liveRaffle ? ["home-raffle.css"] : undefined,
      scripts: liveRaffle ? ["raffle-public.js"] : undefined,
      header: `
        <div class="home-header-copy">
          <p class="eyebrow">Guild Operations</p>
          <h1 id="page-title">OH CRIT I Pulled!</h1>
          <p class="lede">The guild exists in Azeroth. This is where its operations continue outside the game.</p>
        </div>`,
      body: `
        ${liveRaffle ? liveRafflePromotion(liveRaffle, assets) : ""}
        ${temporaryGuildRefreshControl(viewer.authenticated)}
        <section class="home-panel" aria-labelledby="projection-status">
          <div class="status-line" id="projection-status">
            <span class="status-dot" aria-hidden="true"></span>
            <span>Web projection online</span>
          </div>
        </section>`,
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
