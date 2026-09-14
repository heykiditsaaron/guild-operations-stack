import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../auth.js";
import { packagedModuleEnabled } from "../../module-lifecycle.js";
import { getLiveRaffleRound } from "../../modules/raffle/application.js";
import { assetUrl, type AssetName, type AssetRegistry } from "../assets.js";
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

function participationPromotions(assets: AssetRegistry, liveRaffle: boolean): string {
  if (!liveRaffle) return "";
  return `
    <section class="home-section" aria-labelledby="home-happening-title">
      <div class="home-section-heading">
        <p class="home-section-kicker">Happening now</p>
        <h2 id="home-happening-title">Something to jump into</h2>
      </div>
      <div class="home-promotions">
        ${liveRafflePromotion(assets)}
      </div>
    </section>`;
}

export async function registerHomePage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/", async (request, reply) => {
    const [viewer, raffleEnabled] = await Promise.all([
      viewerForRequest(request.cookies[SESSION_COOKIE_NAME]),
      packagedModuleEnabled("raffle"),
    ]);
    const liveRaffle = raffleEnabled ? await getLiveRaffleRound() : null;

    const stylesheets: AssetName[] = ["home.css"];
    if (liveRaffle) stylesheets.push("home-raffle.css");
    const communityActions = viewer.modulePresentation.homeCommunityActions.join("\n");

    const html = renderPage(assets, {
      pathname: "/",
      title: "OH CRIT I Pulled!",
      description: "OH CRIT I Pulled! — a World of Warcraft guild built around good people, shared adventures, and playing the game your way.",
      viewer,
      stylesheets,
      header: `
        <div class="home-community-header">
          <p class="home-community-mark">World of Warcraft guild</p>
          <h1 id="page-title">OH CRIT I Pulled!</h1>
          <p class="home-community-lede">A guild built around good people, shared adventures, and playing the game your way.</p>
          <p class="home-community-note">People first. Low pressure, not low ambition.</p>
        </div>`,
      body: `
        <div class="home-community">
          ${participationPromotions(assets, Boolean(liveRaffle))}

          <section class="home-culture" aria-labelledby="home-culture-title">
            <div class="home-culture-statement">
              <p class="home-section-kicker">Around here</p>
              <h2 id="home-culture-title">You’re a human first, a player second.</h2>
              <p>Push progression, chase improvement, collect everything, run keys, raid, explore, or just show up for the people. Competitive play belongs here. It just isn’t the price of belonging.</p>
            </div>

            <dl class="home-principles">
              <div class="home-principle"><dt>Play your own way</dt><dd>Growth is encouraged when you want it. Pressure, gatekeeping, and elitism are not.</dd></div>
              <div class="home-principle"><dt>Choose your participation</dt><dd>Join the things you want to be part of. Different members engage with the guild in different ways.</dd></div>
              <div class="home-principle"><dt>Real life wins</dt><dd>Commitment matters, but plans change and people have lives outside Azeroth.</dd></div>
              <div class="home-principle"><dt>Enjoy the chaos</dt><dd>Mistakes happen. Laugh at the wipes, celebrate the crits, and pull again.</dd></div>
            </dl>
          </section>

          <section class="home-section" aria-labelledby="home-community-title">
            <div class="home-section-heading">
              <p class="home-section-kicker">The community</p>
              <h2 id="home-community-title">Find your place in it</h2>
              <p>The guild lives in World of Warcraft and gathers day to day in Discord. This site helps make the things happening around the guild easier to find and participate in.</p>
            </div>

            <div class="home-orientation">
              <article class="home-orientation-item">
                <h3>In Azeroth</h3>
                <p>Run the content you enjoy, join organized groups when they fit, and play at the level that makes the game fun for you.</p>
              </article>
              <article class="home-orientation-item">
                <h3>In Discord</h3>
                <p>Follow the channels and activity notifications you care about. Keep the rest quiet. Participation should fit you, not demand your attention.</p>
                ${communityActions}
              </article>
            </div>
          </section>

          <section class="home-bottom-line" aria-label="Guild bottom line">
            <p><strong>The bottom line:</strong> have fun, make friends, respect the people around you, and occasionally yell “OH CRIT, I Pulled!”</p>
          </section>
        </div>`,
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
