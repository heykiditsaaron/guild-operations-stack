import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../../../auth.js";
import {
  raffleClaimCutoffUnix,
  raffleClaimsAreOpen,
  type RaffleRound,
} from "../../../../modules/raffle/domain.js";
import { latestDrawnRaffleWinner, type RaffleHistoryRound } from "../../../../modules/raffle/history-view.js";
import {
  liveRaffleRoundFacts,
  nextListedRaffleRoundFacts,
  type RaffleRoundFacts,
} from "../../../../modules/raffle/queries.js";
import { assetUrl, type AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

type RaffleOverview = RaffleRound & {
  approvedEntryCount: number;
};

function overviewFromFacts(facts: RaffleRoundFacts | null): RaffleOverview | null {
  return facts
    ? {
        ...facts.round,
        approvedEntryCount: facts.metrics.approvedEntryCount,
      }
    : null;
}

function localTime(unixSeconds: number): string {
  const instant = new Date(unixSeconds * 1000).toISOString();
  return `<time datetime="${instant}" data-local-time-unix="${unixSeconds}" data-local-time-date-style="full">${instant}</time>`;
}

function formatGold(value: bigint | string): string {
  return BigInt(value).toLocaleString("en-US");
}

function goldPrize(round: RaffleOverview): bigint | null {
  if (round.prizeKind !== "gold" || round.winnerPercentage === null) return null;
  const pot = BigInt(round.entryPriceGold) * BigInt(round.approvedEntryCount);
  return (pot * BigInt(round.winnerPercentage)) / 100n;
}

function historicalPrize(round: RaffleHistoryRound): string | null {
  if (round.prizeKind === "gold" && round.winnerPercentage !== null) {
    const entries = round.totalEntries ?? round.approvedEntryCount;
    const pot = BigInt(round.entryPriceGold) * BigInt(entries);
    return `${formatGold((pot * BigInt(round.winnerPercentage)) / 100n)} gold`;
  }
  return round.prizeDescription;
}

function referenceLinks(): string {
  return `<nav class="raffle-reference-links" aria-label="Raffle information">
    <a class="raffle-reference-link" href="/events/raffle/history">
      <span class="raffle-reference-title">Previous Raffles</span>
      <span class="raffle-reference-arrow" aria-hidden="true">→</span>
    </a>
    <a class="raffle-reference-link" href="/events/raffle/rules">
      <span class="raffle-reference-title">Rules and Regulations</span>
      <span class="raffle-reference-arrow" aria-hidden="true">→</span>
    </a>
  </nav>`;
}

function recentWinnerBody(round: RaffleHistoryRound | null): string {
  if (!round?.winnerCharacterName) return "";
  const concluded = round.concludedAtUnix === null ? "" : localTime(round.concludedAtUnix);
  const prize = historicalPrize(round);
  const context = round.roundTitle
    ? `${htmlText(round.roundTitle)}${concluded ? ` · ${concluded}` : ""}`
    : concluded || "Previous raffle";
  const avatar = round.winnerAvatarUrl
    ? `<img class="raffle-recent-winner-avatar" src="${htmlText(round.winnerAvatarUrl)}" alt="" aria-hidden="true">`
    : "";

  return `<section class="raffle-workspace raffle-recent-winner" aria-labelledby="raffle-recent-winner-title">
    ${avatar}
    <p class="raffle-plaque-label">Most Recent Winner</p>
    <h2 id="raffle-recent-winner-title">${htmlText(round.winnerCharacterName)}</h2>
    <p class="raffle-status-copy">${context}</p>
    ${prize ? `<p class="raffle-status-copy"><strong>${htmlText(prize)}</strong></p>` : ""}
    <p><a class="raffle-back-link" href="/events/raffle/${encodeURIComponent(round.roundId)}">Inspect this round →</a></p>
  </section>`;
}

function activeRaffleBody(round: RaffleOverview, assets: AssetRegistry, recentWinner: RaffleHistoryRound | null): string {
  const cutoffUnix = raffleClaimCutoffUnix(round.drawingAtUnix);
  const claimsOpen = raffleClaimsAreOpen(round.drawingAtUnix);
  const prize = goldPrize(round);
  const prizeValue = round.prizeKind === "gold" && prize !== null
    ? `${formatGold(prize)} gold`
    : htmlText(round.prizeDescription ?? round.prizeKind);

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
                <strong class="raffle-stat-value">${round.approvedEntryCount.toLocaleString("en-US")}</strong>
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
              <a class="raffle-action raffle-action-secondary" href="/events/raffle/${encodeURIComponent(round.roundId)}">Inspect round</a>
            </div>
          </div>
        </section>
      </div>

      ${recentWinnerBody(recentWinner)}
      ${referenceLinks()}
    </div>`;
}

function standingRaffleBody(listedRound: RaffleOverview | null, recentWinner: RaffleHistoryRound | null): string {
  const upcoming = listedRound
    ? `<a class="raffle-reference-link raffle-upcoming-record" href="/events/raffle/${encodeURIComponent(listedRound.roundId)}">
        <span>
          <span class="raffle-reference-title">An upcoming raffle has been announced</span>
          <span class="raffle-status-copy">Inspect its prize, entry price, and drawing time.</span>
        </span>
        <span class="raffle-reference-arrow" aria-hidden="true">→</span>
      </a>`
    : "";

  return `<div class="raffle-public-shell">
    <section class="raffle-empty-state raffle-home-intro" aria-labelledby="raffle-home-intro-title">
      <h2 id="raffle-home-intro-title">Guild Raffle</h2>
      <p class="raffle-status-copy">When a raffle is live, this page becomes the quickest place to participate and manage your claims. Every round remains available afterward as a public record that guild members can inspect.</p>
      ${upcoming}
    </section>

    ${recentWinnerBody(recentWinner)}
    ${referenceLinks()}
  </div>`;
}

export async function registerRafflePage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/events/raffle", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, liveFacts, listedFacts, recentWinner] = await Promise.all([
      viewerForRequest(sessionToken),
      liveRaffleRoundFacts(),
      nextListedRaffleRoundFacts(),
      latestDrawnRaffleWinner(),
    ]);
    const liveRaffle = overviewFromFacts(liveFacts);
    const listedRaffle = overviewFromFacts(listedFacts);

    const body = liveRaffle
      ? activeRaffleBody(liveRaffle, assets, recentWinner)
      : standingRaffleBody(listedRaffle, recentWinner);

    const html = renderPage(assets, {
      pathname: "/events/raffle",
      title: "Raffle · OH CRIT I Pulled!",
      description: "OH CRIT I Pulled! guild raffle participation and information.",
      viewer,
      secondaryNavigation: {
        kind: "breadcrumb",
        items: [
          { label: "Events" },
          { label: "Raffle" },
        ],
      },
      stylesheets: ["raffle.css", "raffle-winner.css"],
      scripts: liveRaffle ? ["raffle-public.js"] : undefined,
      header: `
        <div class="raffle-page-header">
          <p class="eyebrow">Events</p>
          <h1 id="page-title">Raffle</h1>
        </div>`,
      body,
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
