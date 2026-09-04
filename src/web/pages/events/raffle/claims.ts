import type { FastifyInstance } from "fastify";
import { authenticatedSubject, SESSION_COOKIE_NAME } from "../../../../auth.js";
import { activeRaffleRoundOverview } from "../../../../raffle/live-round.js";
import { raffleClaimsForMember, type RaffleMemberClaim } from "../../../../raffle/member-view.js";
import type { AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

function localTime(date: Date): string {
  const unixSeconds = Math.floor(date.getTime() / 1000);
  const instant = date.toISOString();
  return `<time datetime="${instant}" data-local-time-unix="${unixSeconds}" data-local-time-date-style="medium">${instant}</time>`;
}

function claimResolution(claim: RaffleMemberClaim): string {
  if (claim.resolutionKind === "approved") {
    return claim.resolutionActorLabel ? `Approved by ${claim.resolutionActorLabel}` : "Approved";
  }
  if (claim.resolutionKind === "denied") {
    return claim.resolutionActorLabel ? `Denied by ${claim.resolutionActorLabel}` : "Denied";
  }
  if (claim.resolutionKind === "cancelled") return "Cancelled";
  return "Awaiting attendant review";
}

function claimsList(claims: RaffleMemberClaim[]): string {
  if (claims.length === 0) {
    return `<p class="raffle-status-copy">You have not submitted a claim for this raffle.</p>`;
  }

  return `<ol class="raffle-claims-list">
      ${claims.map((claim) => `
        <li class="raffle-claim-item">
          <div class="raffle-claim-heading">
            <strong>${htmlText(claim.characterName)} · ${claim.requestedTicketCount} ${claim.requestedTicketCount === 1 ? "ticket" : "tickets"}</strong>
            <span class="raffle-claim-state">${htmlText(claimResolution(claim))}</span>
          </div>
          <p class="raffle-claim-meta">Promised deposit: ${htmlText(claim.promisedGoldValue)} gold · ${localTime(claim.createdAt)}</p>
          ${claim.denialReason ? `<p class="raffle-claim-reason">Reason: ${htmlText(claim.denialReason)}</p>` : ""}
          ${claim.resolutionKind === null ? `<button class="raffle-claim-cancel" type="button" data-cancel-raffle-claim="${htmlText(claim.claimId)}">Cancel claim</button>` : ""}
        </li>`).join("\n")}
    </ol>`;
}

export async function registerRaffleClaimsPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/events/raffle/claims", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, subject, liveRaffle] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedSubject(sessionToken),
      activeRaffleRoundOverview(),
    ]);

    let body: string;
    if (!liveRaffle) {
      body = `<section class="raffle-workspace" aria-labelledby="raffle-claims-title"><h2 id="raffle-claims-title">No active raffle.</h2></section>`;
    } else if (!subject) {
      body = `<section class="raffle-workspace" aria-labelledby="raffle-claims-title">
        <h2 id="raffle-claims-title">Your claims</h2>
        <p class="raffle-workspace-intro">Sign in to view your claims for the current raffle.</p>
        <a class="raffle-action" href="/auth/blizzard/start?return_to=%2Fevents%2Fraffle%2Fclaims">Sign in to view claims</a>
      </section>`;
    } else {
      const claims = await raffleClaimsForMember(subject.subjectId, liveRaffle.roundId);
      body = `<section class="raffle-workspace" aria-labelledby="raffle-claims-title">
        <div class="raffle-claims-toolbar">
          <h2 id="raffle-claims-title">Your claims</h2>
          <a class="raffle-action raffle-action-secondary raffle-claims-new" href="/events/raffle/enter">Enter new claim</a>
        </div>
        ${claimsList(claims)}
      </section>`;
    }

    const html = renderPage(assets, {
      pathname: "/events/raffle/claims",
      title: "Raffle Claims · OH CRIT I Pulled! Guild Operations",
      description: "View your claims for the current OH CRIT I Pulled! guild raffle.",
      viewer,
      stylesheets: ["raffle.css"],
      scripts: ["raffle.js"],
      header: `
        <div class="raffle-page-header">
          <nav class="raffle-context-nav" aria-label="Raffle navigation">
            <a class="raffle-back-link" href="/events/raffle">← Back to raffle</a>
          </nav>
          <p class="eyebrow">Events · Raffle</p>
          <h1 id="page-title">Claims</h1>
        </div>`,
      body,
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
