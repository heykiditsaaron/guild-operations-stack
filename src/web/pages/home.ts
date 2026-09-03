import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../auth.js";
import { activeRaffleRound } from "../../raffle/live-round.js";
import type { AssetRegistry } from "../assets.js";
import { htmlText, renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

function liveRafflePromotion(ticketPriceGold: string, drawingAtUnix: number): string {
  const drawingAt = new Date(drawingAtUnix * 1000).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `
    <section class="home-panel" aria-labelledby="live-raffle-title">
      <p class="eyebrow">Event live now</p>
      <h2 id="live-raffle-title">Raffle is live</h2>
      <p class="lede">Tickets are ${htmlText(ticketPriceGold)} gold each. Drawing guideline: ${htmlText(drawingAt)}.</p>
      <p><a href="/events/raffle">View the raffle</a></p>
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
      header: `
        <div class="home-header-copy">
          <p class="eyebrow">Guild Operations</p>
          <h1 id="page-title">OH CRIT I Pulled!</h1>
          <p class="lede">The guild exists in Azeroth. This is where its operations continue outside the game.</p>
        </div>`,
      body: `
        ${liveRaffle ? liveRafflePromotion(liveRaffle.ticketPriceGold, liveRaffle.drawingAtUnix) : ""}
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
