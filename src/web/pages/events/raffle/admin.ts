import type { FastifyInstance } from "fastify";
import { authenticatedSubject, SESSION_COOKIE_NAME } from "../../../../auth.js";
import { RAFFLE_ADMIN_CAPABILITY, subjectHasGuildCapability } from "../../../../guild-permissions.js";
import { raffleRoundsForAdministration } from "../../../../raffle/admin-view.js";
import { raffleClaims, raffleRound, type RaffleClaim, type RaffleRound } from "../../../../raffle/domain.js";
import { assetUrl, type AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

function sectionRule(): string {
  return `<hr aria-hidden="true" style="margin: 0 0 2.5rem; border: 0; border-top: 1px solid rgba(238, 201, 124, 0.18);">`;
}

function drawingLabel(drawingAtUnix: number): string {
  return new Date(drawingAtUnix * 1000).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });
}

function claimTimeLabel(createdAt: Date): string {
  return createdAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function roundStatusLabel(round: RaffleRound): string {
  if (round.status === "live") return "live";
  if (round.status === "created") return "upcoming";
  if (round.status === "drawn") return "drawn";
  if (round.status === "no_entry_cancelled") return "closed · no entries";
  return "cancelled";
}

function roundSummary(round: RaffleRound): string {
  const split = round.prizeKind === "gold" && round.winnerPercentage !== null
    ? `${round.winnerPercentage}% winner share`
    : round.prizeKind;
  return `${htmlText(round.ticketPriceGold)} gold per ticket · ${htmlText(split)} · ${htmlText(drawingLabel(round.drawingAtUnix))}`;
}

function roundActions(round: RaffleRound): string {
  const terminal = round.status === "drawn" || round.status === "admin_cancelled" || round.status === "no_entry_cancelled";
  const activate = round.status === "created"
    ? `<button type="button" data-activate-raffle-round="${htmlText(round.roundId)}" style="min-height: 2.6rem; padding: 0.6rem 0.85rem; border: 1px solid rgba(232,201,134,0.35); border-radius: 0.65rem; background: rgba(232,201,134,0.08); color: #e8c986; font-weight: 700;">Make raffle live</button>`
    : "";
  const viewLive = round.status === "live" ? `<a href="/events/raffle">View live raffle</a>` : "";
  const cancel = terminal ? "" : `<button type="button" data-cancel-raffle-round="${htmlText(round.roundId)}" style="min-height: 2.6rem; padding: 0.6rem 0.85rem; border: 1px solid rgba(255,255,255,0.14); border-radius: 0.65rem; background: rgba(255,255,255,0.035); color: #d8d4ca;">Cancel round</button>`;

  return `<div style="display: flex; gap: 0.8rem; align-items: center; flex-wrap: wrap; margin-top: 0.8rem;">
    <a href="/events/raffle/admin/${htmlText(round.roundId)}">${terminal ? "View round ledger" : "Manage round"}</a>
    ${viewLive}
    ${activate}
    ${cancel}
  </div>`;
}

function roundList(rounds: RaffleRound[], emptyText: string): string {
  if (rounds.length === 0) return `<p style="color: #aaa69c;">${htmlText(emptyText)}</p>`;

  return `<ol style="list-style: none; margin: 0; padding: 0; display: grid; gap: 1.25rem;">
    ${rounds.map((round) => `
      <li style="padding-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.07);">
        <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap;">
          <strong>${round.status === "live" ? "Live raffle" : round.status === "created" ? "Upcoming raffle" : "Closed raffle"}</strong>
          <span style="color: #aaa69c; font-size: 0.86rem;">${htmlText(roundStatusLabel(round))}</span>
        </div>
        <p style="margin: 0.45rem 0 0; color: #c9c5ba; line-height: 1.55;">${roundSummary(round)}</p>
        ${roundActions(round)}
      </li>`).join("\n")}
  </ol>`;
}

function createRoundForm(): string {
  return `<form data-raffle-admin-create style="display: grid; gap: 1rem; margin-top: 1.25rem;">
    <label style="display: grid; gap: 0.4rem;">
      <span>Drawing deadline</span>
      <input data-raffle-admin-drawing type="datetime-local" required style="min-height: 3rem; padding: 0.65rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 0.65rem; background: #17181d; color: inherit;">
    </label>
    <label style="display: grid; gap: 0.4rem;">
      <span>Ticket price (gold)</span>
      <input data-raffle-admin-price type="number" min="1" step="1" inputmode="numeric" required style="min-height: 3rem; padding: 0.65rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 0.65rem; background: #17181d; color: inherit;">
    </label>
    <label style="display: grid; gap: 0.4rem;">
      <span>Winner share (%)</span>
      <input data-raffle-admin-winner-percentage type="number" min="1" max="100" step="1" value="50" inputmode="numeric" required style="min-height: 3rem; padding: 0.65rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 0.65rem; background: #17181d; color: inherit;">
    </label>
    <p style="margin: 0; color: #aaa69c; line-height: 1.55;">Creating a round prepares it only. Members will not see or participate in it until an attendant explicitly makes it live.</p>
    <button type="submit" style="min-height: 3rem; padding: 0.7rem 1rem; border: 1px solid rgba(232,201,134,0.35); border-radius: 0.7rem; background: rgba(232,201,134,0.08); color: #e8c986; font-weight: 700;">Create raffle draft</button>
    <p data-raffle-admin-status aria-live="polite" style="min-height: 1.25rem; margin: 0; color: #aaa69c;"></p>
  </form>`;
}

function effectiveClaimStatus(claim: RaffleClaim, round: RaffleRound): string {
  if (claim.resolutionKind === "approved") {
    return round.status === "admin_cancelled" ? "Approved · round later cancelled" : "Approved";
  }
  if (claim.resolutionKind === "denied") return "Denied";
  if (claim.resolutionKind === "cancelled") return "Cancelled by claimant";
  if (round.status === "admin_cancelled") return "Unresolved when round cancelled";
  if (round.status === "drawn" || round.status === "no_entry_cancelled") return "Unresolved at closure";
  return "Awaiting attendant review";
}

function claimLedger(claims: RaffleClaim[], round: RaffleRound): string {
  if (claims.length === 0) return `<p style="color: #aaa69c;">No claims were submitted for this round.</p>`;

  return `<ol style="list-style: none; margin: 0; padding: 0; display: grid; gap: 1.25rem;">
    ${claims.map((claim) => `
      <li style="padding-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.07);">
        <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap;">
          <strong>${htmlText(claim.characterName)} · ${claim.requestedTicketCount} ${claim.requestedTicketCount === 1 ? "ticket" : "tickets"}</strong>
          <span style="color: #aaa69c; font-size: 0.86rem;">${htmlText(effectiveClaimStatus(claim, round))}</span>
        </div>
        <p style="margin: 0.45rem 0 0; color: #c9c5ba; line-height: 1.55;">Promised deposit: ${htmlText(claim.promisedGoldValue)} gold · ${htmlText(claimTimeLabel(claim.createdAt))}</p>
        ${claim.denialReason ? `<p style="margin: 0.4rem 0 0; color: #c9c5ba;">Denial reason: ${htmlText(claim.denialReason)}</p>` : ""}
      </li>`).join("\n")}
  </ol>`;
}

function pendingClaims(claims: RaffleClaim[], round: RaffleRound): string {
  const pending = claims.filter((claim) => claim.resolutionKind === null);
  if (pending.length === 0) return `<p style="color: #aaa69c;">There are no claims awaiting review for this round.</p>`;

  return `<ol style="list-style: none; margin: 0; padding: 0; display: grid; gap: 1.5rem;">
    ${pending.map((claim) => `
      <li style="padding-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.07);">
        <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap;">
          <strong>${htmlText(claim.characterName)}</strong>
          <span style="color: #aaa69c; font-size: 0.86rem;">${htmlText(claimTimeLabel(claim.createdAt))}</span>
        </div>
        <p style="margin: 0.45rem 0 0; color: #c9c5ba; line-height: 1.55;">${claim.requestedTicketCount} ${claim.requestedTicketCount === 1 ? "ticket" : "tickets"} · promised deposit ${htmlText(claim.promisedGoldValue)} gold</p>
        ${round.status === "live" ? `
          <div style="display: grid; gap: 0.75rem; margin-top: 1rem;">
            <button type="button" data-approve-raffle-claim="${htmlText(claim.claimId)}" style="min-height: 2.7rem; padding: 0.65rem 0.85rem; border: 1px solid rgba(124,198,141,0.35); border-radius: 0.65rem; background: rgba(124,198,141,0.07); color: #b9dfc1; font-weight: 700;">Approve claim</button>
            <label style="display: grid; gap: 0.4rem;">
              <span style="color: #c9c5ba; font-size: 0.9rem;">Denial reason</span>
              <input data-raffle-denial-reason="${htmlText(claim.claimId)}" type="text" style="min-height: 2.8rem; padding: 0.65rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 0.65rem; background: #17181d; color: inherit;">
            </label>
            <button type="button" data-deny-raffle-claim="${htmlText(claim.claimId)}" style="min-height: 2.7rem; padding: 0.65rem 0.85rem; border: 1px solid rgba(255,255,255,0.14); border-radius: 0.65rem; background: rgba(255,255,255,0.035); color: #d8d4ca;">Deny claim</button>
          </div>` : `<p style="margin: 0.8rem 0 0; color: #aaa69c;">This round is not live, so its claims cannot be adjudicated.</p>`}
      </li>`).join("\n")}
  </ol>`;
}

function roundFacts(round: RaffleRound): string {
  const prize = round.prizeKind === "gold"
    ? `Gold${round.winnerPercentage !== null ? ` · ${round.winnerPercentage}% winner share` : ""}`
    : round.prizeKind;
  return `<dl style="display: grid; grid-template-columns: auto 1fr; gap: 0.55rem 1rem; margin: 0; color: #c9c5ba;">
    <dt>Status</dt><dd style="margin: 0;">${htmlText(roundStatusLabel(round))}</dd>
    <dt>Prize kind</dt><dd style="margin: 0;">${htmlText(prize)}</dd>
    <dt>Ticket price</dt><dd style="margin: 0;">${htmlText(round.ticketPriceGold)} gold</dd>
    <dt>Drawing deadline</dt><dd style="margin: 0;">${htmlText(drawingLabel(round.drawingAtUnix))}</dd>
    ${round.totalEntries !== null ? `<dt>Final entries</dt><dd style="margin: 0;">${round.totalEntries}</dd>` : ""}
  </dl>`;
}

async function adminContext(sessionToken: string | undefined) {
  const [viewer, subject] = await Promise.all([
    viewerForRequest(sessionToken),
    authenticatedSubject(sessionToken),
  ]);
  const authorized = subject ? await subjectHasGuildCapability(subject.subjectId, RAFFLE_ADMIN_CAPABILITY) : false;
  return { viewer, subject, authorized };
}

export async function registerRaffleAdminPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/events/raffle/admin", async (request, reply) => {
    const { viewer, subject, authorized } = await adminContext(request.cookies[SESSION_COOKIE_NAME]);

    if (!authorized) {
      const html = renderPage(assets, {
        pathname: "/events/raffle/admin",
        title: "Raffle Administration · OH CRIT I Pulled! Guild Operations",
        viewer,
        header: `<div class="home-header-copy"><p class="eyebrow">Events · Raffle</p><h1 id="page-title">Administration</h1></div>`,
        body: `<div style="width: min(100%, 46rem);">${sectionRule()}<h2>Raffle administration is not available for this account.</h2></div>`,
      });
      return reply.code(subject ? 403 : 401).type("text/html; charset=utf-8").send(html);
    }

    const rounds = await raffleRoundsForAdministration();
    const live = rounds.filter((round) => round.status === "live");
    const upcoming = rounds.filter((round) => round.status === "created");
    const closed = rounds.filter((round) => round.status !== "live" && round.status !== "created");

    const html = renderPage(assets, {
      pathname: "/events/raffle/admin",
      title: "Raffle Administration · OH CRIT I Pulled! Guild Operations",
      description: "Operate the OH CRIT I Pulled! guild raffle.",
      viewer,
      header: `
        <div class="home-header-copy">
          <p class="eyebrow">Events · Raffle</p>
          <h1 id="page-title">Administration</h1>
          <p class="lede">Prepare, operate, and inspect the guild raffle.</p>
        </div>`,
      body: `
        <div style="width: min(100%, 46rem);">
          ${sectionRule()}
          <section aria-labelledby="live-raffle-heading">
            <h2 id="live-raffle-heading">Live raffle</h2>
            ${roundList(live, "There is no live raffle.")}
          </section>
          <div style="margin-top: 2.5rem;">${sectionRule()}</div>
          <section aria-labelledby="upcoming-raffles-heading">
            <h2 id="upcoming-raffles-heading">Upcoming raffles</h2>
            ${roundList(upcoming, "There are no upcoming raffles.")}
          </section>
          <div style="margin-top: 2.5rem;">${sectionRule()}</div>
          <section aria-labelledby="closed-raffles-heading">
            <h2 id="closed-raffles-heading">Closed raffles</h2>
            ${roundList(closed, "There are no closed raffles yet.")}
          </section>
          <div style="margin-top: 2.5rem;">${sectionRule()}</div>
          <section aria-labelledby="create-round-heading">
            <h2 id="create-round-heading">Prepare a raffle</h2>
            ${createRoundForm()}
          </section>
        </div>
        <script src="${assetUrl(assets, "raffle.js")}" defer></script>`,
    });

    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  });

  app.get<{ Params: { roundId: string } }>("/events/raffle/admin/:roundId", async (request, reply) => {
    const { viewer, subject, authorized } = await adminContext(request.cookies[SESSION_COOKIE_NAME]);
    const pathname = `/events/raffle/admin/${request.params.roundId}`;

    if (!authorized) {
      return reply.code(subject ? 403 : 401).type("text/html; charset=utf-8").send(renderPage(assets, {
        pathname,
        title: "Raffle Round Administration · OH CRIT I Pulled! Guild Operations",
        viewer,
        header: `<div class="home-header-copy"><p class="eyebrow">Events · Raffle</p><h1 id="page-title">Round</h1></div>`,
        body: `<div style="width: min(100%, 46rem);">${sectionRule()}<h2>Raffle administration is not available for this account.</h2></div>`,
      }));
    }

    const round = await raffleRound(request.params.roundId);
    if (!round) {
      return reply.code(404).type("text/html; charset=utf-8").send(renderPage(assets, {
        pathname,
        title: "Raffle Round Not Found · OH CRIT I Pulled! Guild Operations",
        viewer,
        header: `<div class="home-header-copy"><p class="eyebrow">Events · Raffle</p><h1 id="page-title">Round not found</h1></div>`,
        body: `<div style="width: min(100%, 46rem);">${sectionRule()}<p>This raffle round does not exist.</p></div>`,
      }));
    }

    const claims = await raffleClaims(round.roundId);
    const terminal = round.status === "drawn" || round.status === "admin_cancelled" || round.status === "no_entry_cancelled";
    const controls = terminal ? "" : `
      <div style="display: flex; gap: 0.8rem; flex-wrap: wrap; margin-top: 1.25rem;">
        ${round.status === "created" ? `<button type="button" data-activate-raffle-round="${htmlText(round.roundId)}" style="min-height: 2.6rem; padding: 0.6rem 0.85rem; border: 1px solid rgba(232,201,134,0.35); border-radius: 0.65rem; background: rgba(232,201,134,0.08); color: #e8c986; font-weight: 700;">Make raffle live</button>` : ""}
        <button type="button" data-cancel-raffle-round="${htmlText(round.roundId)}" style="min-height: 2.6rem; padding: 0.6rem 0.85rem; border: 1px solid rgba(255,255,255,0.14); border-radius: 0.65rem; background: rgba(255,255,255,0.035); color: #d8d4ca;">Cancel round</button>
      </div>`;

    const html = renderPage(assets, {
      pathname: `/events/raffle/admin/${round.roundId}`,
      title: "Raffle Round Administration · OH CRIT I Pulled! Guild Operations",
      description: "Review and operate a guild raffle round.",
      viewer,
      header: `
        <div class="home-header-copy">
          <p class="eyebrow">Events · Raffle · Administration</p>
          <h1 id="page-title">Round</h1>
          <p class="lede">${terminal ? "Inspect the preserved raffle record." : "Review claims against the WoW guild-bank ledger and operate this raffle round."}</p>
        </div>`,
      body: `
        <div style="width: min(100%, 46rem);">
          ${sectionRule()}
          <section aria-labelledby="round-facts-heading">
            <h2 id="round-facts-heading">Round facts</h2>
            ${roundFacts(round)}
            ${controls}
          </section>
          ${round.status === "live" ? `
            <div style="margin-top: 2.5rem;">${sectionRule()}</div>
            <section aria-labelledby="pending-claims-heading">
              <h2 id="pending-claims-heading">Pending claims</h2>
              ${pendingClaims(claims, round)}
            </section>` : ""}
          <div style="margin-top: 2.5rem;">${sectionRule()}</div>
          <section aria-labelledby="claim-ledger-heading">
            <h2 id="claim-ledger-heading">Claim ledger</h2>
            <p style="color: #aaa69c; line-height: 1.55;">Every claim submitted to this round remains visible with the outcome established before the round closed.</p>
            ${claimLedger(claims, round)}
          </section>
          <p style="margin-top: 2.5rem;"><a href="/events/raffle/admin">Back to Manage Raffles</a></p>
        </div>
        <script src="${assetUrl(assets, "raffle.js")}" defer></script>`,
    });

    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  });
}
