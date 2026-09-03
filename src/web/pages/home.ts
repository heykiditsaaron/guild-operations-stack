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

function temporaryGuildRefreshControl(authenticated: boolean): string {
  if (!authenticated) return "";

  return `
    <section class="home-panel" aria-labelledby="guild-refresh-title">
      <p class="eyebrow">Temporary operations control</p>
      <h2 id="guild-refresh-title">Guild roster refresh</h2>
      <p class="lede">Refresh Blizzard guild authority and reconcile the current roster.</p>
      <form action="/guild/refresh" method="post">
        <button type="submit" style="min-height: 2.8rem; padding: 0.65rem 0.9rem; border: 1px solid rgba(232,201,134,0.35); border-radius: 0.65rem; background: rgba(232,201,134,0.08); color: #e8c986; font: inherit; font-weight: 700; cursor: pointer;">
          Refresh guild roster
        </button>
      </form>
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
