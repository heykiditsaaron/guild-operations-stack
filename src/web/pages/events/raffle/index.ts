import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../../../auth.js";
import { activeRaffleRound } from "../../../../raffle/live-round.js";
import type { RaffleRound } from "../../../../raffle/domain.js";
import type { AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

function drawingLabel(drawingAtUnix: number): string {
  return new Date(drawingAtUnix * 1000).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });
}

function prizeLabel(round: RaffleRound): string {
  if (round.prizeKind === "gold" && round.winnerPercentage !== null) {
    if (round.winnerPercentage === 100) return "100% of the raffle pot goes to the winner.";
    return `${round.winnerPercentage}% of the raffle pot goes to the winner; the remainder stays with the guild bank.`;
  }

  return `Prize: ${round.prizeKind}.`;
}

function sectionRule(): string {
  return `<hr aria-hidden="true" style="margin: 2.5rem 0 0; border: 0; border-top: 1px solid rgba(238, 201, 124, 0.18);">`;
}

function liveRoundBody(round: RaffleRound): string {
  return `
    <section aria-labelledby="raffle-status" style="width: min(100%, 46rem);">
      <div class="status-line" id="raffle-status">
        <span class="status-dot" aria-hidden="true"></span>
        <span>Raffle live</span>
      </div>
      <h2>${htmlText(round.ticketPriceGold)} gold per ticket</h2>
      <p class="lede">${htmlText(prizeLabel(round))}</p>
      <p>Drawing guideline: <strong>${htmlText(drawingLabel(round.drawingAtUnix))}</strong></p>
      <p>The drawing time is informational. The raffle remains live until an attendant concludes it.</p>
      ${sectionRule()}
    </section>`;
}

function noLiveRoundBody(): string {
  return `
    <section aria-labelledby="raffle-status" style="width: min(100%, 46rem);">
      <h2 id="raffle-status">No raffle is live right now.</h2>
      <p class="lede">When the guild opens a raffle, its current terms will appear here.</p>
      ${sectionRule()}
    </section>`;
}

export async function registerRafflePage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/events/raffle", async (request, reply) => {
    const [viewer, liveRaffle] = await Promise.all([
      viewerForRequest(request.cookies[SESSION_COOKIE_NAME]),
      activeRaffleRound(),
    ]);

    const html = renderPage(assets, {
      pathname: "/events/raffle",
      title: "Raffle · OH CRIT I Pulled! Guild Operations",
      description: "Current OH CRIT I Pulled! guild raffle information.",
      viewer,
      header: `
        <div class="home-header-copy">
          <p class="eyebrow">Events</p>
          <h1 id="page-title">Raffle</h1>
          <p class="lede">The guild raffle, operated and preserved through Guild Operations.</p>
        </div>`,
      body: liveRaffle ? liveRoundBody(liveRaffle) : noLiveRoundBody(),
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
