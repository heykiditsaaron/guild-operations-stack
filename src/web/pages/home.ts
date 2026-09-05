import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../auth.js";
import { activeRaffleRound } from "../../modules/raffle/live-round.js";
import { assetUrl, type AssetRegistry } from "../assets.js";
import { renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

function liveRafflePromotion(assets: AssetRegistry): string {
  return `
    <a class="home-raffle-promo" href="/events/raffle" aria-labelledby="home-raffle-promo-title">
      <img class="home-raffle-promo-art" src="${assetUrl(assets, "images/raffle/gold-sack.png")}" alt="" aria-hidden="true">
      <div class="home-raffle-promo-main">
        <p class="home-raffle-promo-kicker">Guild raffle live</p>
        <h2 class="home-raffle-promo-title" id="home-raffle-promo-title">Take your shot at the pot.</h2>
      </div>
      <span class="home-raffle-promo-cta">
        <span>View the raffle</span>
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
      <button class="home-guild-refresh-action" type="button" data-refresh-guild>
        Refresh guild roster
      </button>
      <p data-guild-refresh-status aria-live="polite"></p>
    </section>`;
}

export async function registerHomePage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/", async (request, reply) => {
    const [viewer, liveRaffle] = await Promise.all([
      viewerForRequest(request.cookies[SESSION_COOKIE_NAME]),
      activeRaffleRound(),
    ]);

    const html = renderPage(assets, {
      pathname: "/",
      title: "OH CRIT I Pulled! Guild Operations",
      description: "Guild operations and community participation for OH CRIT I Pulled!",
      viewer,
      stylesheets: liveRaffle ? ["home.css", "home-raffle.css"] : ["home.css"],
      header: `
        <div class="home-header-copy">
          <p class="eyebrow">Guild Operations</p>
          <h1 id="page-title">OH CRIT I Pulled!</h1>
          <p class="lede">The guild exists in Azeroth. This is where its operations continue outside the game.</p>
        </div>`,
      body: `
        ${liveRaffle ? liveRafflePromotion(assets) : ""}
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
