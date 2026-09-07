import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../../../auth.js";
import { raffleClaimsAreOpen } from "../../../../modules/raffle/domain.js";
import {
  rafflePublicRound,
  type RafflePublicClaim,
  type RafflePublicRound,
} from "../../../../modules/raffle/round-view.js";
import type { AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

function localTime(unixSeconds: number, dateStyle: "medium" | "full" = "medium"): string {
  const instant = new Date(unixSeconds * 1000).toISOString();
  return `<time datetime="${instant}" data-local-time-unix="${unixSeconds}" data-local-time-date-style="${dateStyle}">${instant}</time>`;
}

function formatGold(value: bigint | string): string {
  return BigInt(value).toLocaleString("en-US");
}

function statusLabel(round: RafflePublicRound): string {
  if (round.status === "listed") return "Upcoming";
  if (round.status === "live") return "Live";
  if (round.conclusion === "drawn") return "Drawn";
  if (round.conclusion === "operator_cancelled") return "Cancelled";
  if (round.conclusion === "no_participation") return "No participation";
  return "Concluded";
}

function claimStatus(claim: RafflePublicClaim): string {
  if (claim.resolutionKind === "approved") return "Approved";
  if (claim.resolutionKind === "denied") return "Denied";
  if (claim.resolutionKind === "cancelled") return "Cancelled";
  return "Pending";
}

function configuredPrize(round: RafflePublicRound): string {
  if (round.prizeKind === "gold") {
    return round.winnerPercentage === null ? "Gold" : `${round.winnerPercentage}% of the pot`;
  }
  return round.prizeDescription ?? round.prizeKind;
}

function finalWinnings(round: RafflePublicRound): string | null {
  if (round.conclusion !== "drawn") return null;
  if (round.prizeKind !== "gold") return round.prizeDescription;
  if (round.winnerPercentage === null) return null;

  const entries = round.totalEntries ?? round.approvedEntryCount;
  const pot = BigInt(round.ticketPriceGold) * BigInt(entries);
  return `${formatGold((pot * BigInt(round.winnerPercentage)) / 100n)} gold`;
}

function fact(label: string, value: string): string {
  return `<div class="raffle-history-fact"><dt>${htmlText(label)}</dt><dd>${value}</dd></div>`;
}

function roundFacts(round: RafflePublicRound): string {
  const approvedLabel = round.conclusion === "operator_cancelled"
    ? "Approved entries at cancellation"
    : round.status === "concluded"
      ? "Final approved entries"
      : "Approved entries";

  return `<section class="raffle-round-section" aria-labelledby="raffle-round-terms-title">
    <div class="raffle-round-section-heading">
      <h2 id="raffle-round-terms-title">Round details</h2>
    </div>
    <dl class="raffle-history-facts">
      ${fact("Status", htmlText(statusLabel(round)))}
      ${fact("Established", localTime(round.createdAtUnix))}
      ${fact("Estimated drawing time", localTime(round.drawingAtUnix, "full"))}
      ${fact("Ticket price", `${formatGold(round.ticketPriceGold)} gold`)}
      ${fact("Prize", htmlText(configuredPrize(round)))}
      ${fact(approvedLabel, round.approvedEntryCount.toLocaleString("en-US"))}
      ${round.liveAtUnix === null ? "" : fact("Went live", localTime(round.liveAtUnix))}
      ${round.concludedAtUnix === null ? "" : fact("Concluded", localTime(round.concludedAtUnix))}
    </dl>
  </section>`;
}

function outcome(round: RafflePublicRound): string {
  if (round.status !== "concluded") return "";

  if (round.conclusion === "drawn") {
    const winnings = finalWinnings(round);
    return `<section class="raffle-round-section raffle-round-outcome" aria-labelledby="raffle-round-outcome-title">
      <div class="raffle-round-section-heading">
        <p class="raffle-plaque-label">Outcome</p>
        <h2 id="raffle-round-outcome-title">${round.winnerCharacterName ? htmlText(round.winnerCharacterName) : "Winner unavailable"}</h2>
      </div>
      <dl class="raffle-history-facts">
        ${fact("Winner", round.winnerCharacterName ? htmlText(round.winnerCharacterName) : "Unavailable")}
        ${fact("Winnings", winnings ? htmlText(winnings) : "Unavailable")}
        ${fact("Final entries in the draw", (round.totalEntries ?? round.approvedEntryCount).toLocaleString("en-US"))}
      </dl>
    </section>`;
  }

  if (round.conclusion === "operator_cancelled") {
    return `<section class="raffle-round-section raffle-round-outcome" aria-labelledby="raffle-round-outcome-title">
      <div class="raffle-round-section-heading">
        <p class="raffle-plaque-label">Outcome</p>
        <h2 id="raffle-round-outcome-title">Round cancelled</h2>
        <p class="raffle-status-copy">The claim ledger below is preserved exactly as raffle participation stood when the round was cancelled. Refund completion is not inferred here.</p>
      </div>
    </section>`;
  }

  return `<section class="raffle-round-section raffle-round-outcome" aria-labelledby="raffle-round-outcome-title">
    <div class="raffle-round-section-heading">
      <p class="raffle-plaque-label">Outcome</p>
      <h2 id="raffle-round-outcome-title">No participation</h2>
      <p class="raffle-status-copy">The round concluded without an approved participation population to draw from.</p>
    </div>
  </section>`;
}

function claimResolution(claim: RafflePublicClaim): string {
  const attribution = (claim.resolutionKind === "approved" || claim.resolutionKind === "denied")
    && claim.resolutionActorLabel
    ? ` by ${htmlText(claim.resolutionActorLabel)}`
    : "";
  const resolutionTime = claim.resolvedAtUnix === null
    ? ""
    : `<div class="raffle-ledger-resolution-time">${localTime(claim.resolvedAtUnix)}</div>`;
  const reason = claim.resolutionKind === "denied" && claim.denialReason
    ? `<div class="raffle-ledger-note">${htmlText(claim.denialReason)}</div>`
    : "";

  return `<span class="raffle-ledger-status">${htmlText(claimStatus(claim))}${attribution}</span>${resolutionTime}${reason}`;
}

function claimLedger(round: RafflePublicRound): string {
  if (round.status === "listed") return "";

  const rows = round.claims.map((claim) => `<tr>
      <td data-label="Character"><strong>${htmlText(claim.characterName)}</strong></td>
      <td data-label="Requested">${claim.requestedTicketCount.toLocaleString("en-US")}</td>
      <td data-label="Promised">${formatGold(claim.promisedGoldValue)} gold</td>
      <td data-label="Claimed">${localTime(claim.createdAtUnix)}</td>
      <td data-label="Resolution">${claimResolution(claim)}</td>
    </tr>`).join("\n");

  return `<section class="raffle-round-section" aria-labelledby="raffle-round-ledger-title">
    <div class="raffle-round-section-heading">
      <h2 id="raffle-round-ledger-title">Claims</h2>
      <p class="raffle-status-copy">One row represents one claim. Requested entry count becomes draw weight only when that claim is approved.</p>
    </div>
    ${round.claims.length === 0
      ? '<p class="raffle-status-copy">No claims were recorded for this round.</p>'
      : `<div class="raffle-ledger-wrap"><table class="raffle-ledger">
          <thead><tr><th scope="col">Character</th><th scope="col">Requested</th><th scope="col">Promised</th><th scope="col">Claimed</th><th scope="col">Resolution</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`}
  </section>`;
}

function participationLink(round: RafflePublicRound): string {
  if (round.status !== "live") return "";
  const label = raffleClaimsAreOpen(round.drawingAtUnix) ? "Participate in this raffle" : "View current raffle";
  return `<div class="raffle-actions"><a class="raffle-action" href="/events/raffle">${htmlText(label)}</a></div>`;
}

function roundBody(round: RafflePublicRound): string {
  const intro = round.status === "listed"
    ? "This announced round is available for inspection before participation opens."
    : round.status === "live"
      ? "This is the current public record of the live round. Participation remains on the Raffle homepage."
      : "This concluded round is preserved as a durable public record.";
  const statusClass = round.status === "live" ? "raffle-live-kicker" : "raffle-plaque-label";

  return `<div class="raffle-public-shell raffle-round-record">
    <section class="raffle-round-summary" aria-labelledby="raffle-round-summary-title">
      <p class="${statusClass}">${htmlText(statusLabel(round))}</p>
      <h2 id="raffle-round-summary-title">${htmlText(round.roundTitle ?? "Guild Raffle")}</h2>
      <p class="raffle-status-copy">${htmlText(intro)}</p>
      ${participationLink(round)}
    </section>
    ${outcome(round)}
    ${roundFacts(round)}
    ${claimLedger(round)}
  </div>`;
}

export async function registerRaffleRoundPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/events/raffle/:roundId", async (request, reply) => {
    const { roundId } = request.params as { roundId: string };
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, round] = await Promise.all([
      viewerForRequest(sessionToken),
      rafflePublicRound(roundId),
    ]);

    if (!round) {
      return reply.code(404).type("text/html; charset=utf-8").send(renderPage(assets, {
        pathname: `/events/raffle/${roundId}`,
        title: "Raffle Round Not Found · OH CRIT I Pulled!",
        description: "Raffle round not found.",
        viewer,
        secondaryNavigation: {
          kind: "breadcrumb",
          items: [
            { label: "Events" },
            { label: "Raffle", href: "/events/raffle" },
            { label: "Round" },
          ],
        },
        stylesheets: ["raffle.css", "raffle-round.css"],
        header: `<div class="raffle-page-header"><h1 id="page-title">Raffle round not found</h1></div>`,
        body: '<section class="raffle-reference-page raffle-reference-empty"><p>This raffle round does not exist.</p></section>',
      }));
    }

    const title = round.roundTitle ?? "Guild Raffle";
    const html = renderPage(assets, {
      pathname: `/events/raffle/${round.roundId}`,
      title: `${title} · Raffle · OH CRIT I Pulled!`,
      description: `Public raffle round record for ${title}.`,
      viewer,
      secondaryNavigation: {
        kind: "breadcrumb",
        items: [
          { label: "Events" },
          { label: "Raffle", href: "/events/raffle" },
          { label: title },
        ],
      },
      stylesheets: ["raffle.css", "raffle-round.css"],
      header: `
        <div class="raffle-page-header">
          <p class="eyebrow">Events · Raffle</p>
          <h1 id="page-title">${htmlText(title)}</h1>
        </div>`,
      body: roundBody(round),
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
