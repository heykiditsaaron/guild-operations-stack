import type { FastifyInstance } from "fastify";
import { authenticatedSubject, SESSION_COOKIE_NAME } from "../../../../auth.js";
import { RAFFLE_ADMIN_CAPABILITY, subjectHasGuildCapability } from "../../../../guild-permissions.js";
import {
  guildieAttributionsForSubjects,
  type GuildieAttribution,
} from "../../../../guildie-attribution.js";
import { raffleRoundsForAdministration, type RaffleAdministrationRound } from "../../../../raffle/admin-view.js";
import {
  raffleClaimCutoffUnix,
  raffleClaims,
  raffleRound,
  type RaffleClaim,
  type RaffleRound,
} from "../../../../raffle/domain.js";
import { assetUrl, type AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

type AttributionLookup = Map<string, GuildieAttribution>;

function sectionRule(): string {
  return `<hr aria-hidden="true" style="margin: 0 0 2.5rem; border: 0; border-top: 1px solid rgba(238, 201, 124, 0.18);">`;
}

function localTime(unixSeconds: number, dateStyle: "full" | "medium" = "full"): string {
  const instant = new Date(unixSeconds * 1000).toISOString();
  return `<time datetime="${instant}" data-local-time-unix="${unixSeconds}" data-local-time-date-style="${dateStyle}">${instant}</time>`;
}

function eventTime(instant: Date): string {
  return localTime(Math.floor(instant.getTime() / 1000), "medium");
}

function actorName(subjectId: string, attributions: AttributionLookup): string {
  return htmlText(attributions.get(subjectId)?.displayName ?? `Guildie ${subjectId.slice(0, 8)}`);
}

function attributionFact(
  label: string,
  subjectId: string | null,
  at: Date | null,
  attributions: AttributionLookup,
): string {
  if (!subjectId || !at) return "";
  return `<dt>${htmlText(label)}</dt><dd style="margin: 0;">${actorName(subjectId, attributions)} · ${eventTime(at)}</dd>`;
}

function roundOverviewAttribution(round: RaffleAdministrationRound, attributions: AttributionLookup): string {
  if (round.status === "live" && round.liveBySubjectId) {
    return `<div class="raffle-overview-attribution"><span>Made live by <strong>${actorName(round.liveBySubjectId, attributions)}</strong></span></div>`;
  }
  return `<div class="raffle-overview-attribution"><span>Created by <strong>${actorName(round.createdBySubjectId, attributions)}</strong></span></div>`;
}

function claimResolutionAttribution(claim: RaffleClaim, attributions: AttributionLookup): string {
  if (claim.resolutionKind === "approved" && claim.approvedBySubjectId && claim.approvedAt) {
    return `Approved by ${actorName(claim.approvedBySubjectId, attributions)} · ${eventTime(claim.approvedAt)}`;
  }
  if (claim.resolutionKind === "denied" && claim.deniedBySubjectId && claim.deniedAt) {
    return `Denied by ${actorName(claim.deniedBySubjectId, attributions)} · ${eventTime(claim.deniedAt)}`;
  }
  if (claim.resolutionKind === "cancelled" && claim.cancelledBySubjectId && claim.cancelledAt) {
    return `Cancelled by ${actorName(claim.cancelledBySubjectId, attributions)} · ${eventTime(claim.cancelledAt)}`;
  }
  return "";
}

function roundStatusLabel(round: RaffleRound): string {
  if (round.status === "live") return "live";
  if (round.status === "created") return "upcoming";
  if (round.status === "drawn") return "drawn";
  if (round.status === "no_entry_cancelled") return "closed · no entries";
  return "cancelled";
}

function adminBreadcrumb(round?: RaffleRound): string {
  return `<nav class="admin-breadcrumb" aria-label="Administrative breadcrumb">
    <span>Administration</span>
    <span aria-hidden="true">›</span>
    ${round ? `<a href="/admin/raffle">Raffle</a><span aria-hidden="true">›</span><span>${localTime(round.drawingAtUnix, "medium")}</span>` : `<span aria-current="page">Raffle</span>`}
  </nav>`;
}

function goldMetrics(ticketPriceGold: string, winnerPercentage: number | null, approvedTicketCount: number): { pot: bigint; prize: bigint | null } {
  const pot = BigInt(ticketPriceGold) * BigInt(approvedTicketCount);
  const prize = winnerPercentage === null ? null : (pot * BigInt(winnerPercentage)) / 100n;
  return { pot, prize };
}

function claimMetrics(claims: RaffleClaim[]): {
  claimCount: number;
  pendingClaimCount: number;
  approvedClaimCount: number;
  cancelledClaimCount: number;
  deniedClaimCount: number;
  approvedTicketCount: number;
} {
  return claims.reduce((metrics, claim) => {
    metrics.claimCount += 1;
    if (claim.resolutionKind === null) metrics.pendingClaimCount += 1;
    else if (claim.resolutionKind === "approved") {
      metrics.approvedClaimCount += 1;
      metrics.approvedTicketCount += claim.requestedTicketCount;
    } else if (claim.resolutionKind === "cancelled") metrics.cancelledClaimCount += 1;
    else if (claim.resolutionKind === "denied") metrics.deniedClaimCount += 1;
    return metrics;
  }, {
    claimCount: 0,
    pendingClaimCount: 0,
    approvedClaimCount: 0,
    cancelledClaimCount: 0,
    deniedClaimCount: 0,
    approvedTicketCount: 0,
  });
}

function managementFacts(
  round: RaffleRound,
  metrics: ReturnType<typeof claimMetrics>,
  attributions: AttributionLookup,
): string {
  const gold = round.prizeKind === "gold"
    ? goldMetrics(round.ticketPriceGold, round.winnerPercentage, metrics.approvedTicketCount)
    : null;
  const prize = round.prizeKind === "gold"
    ? `Gold${round.winnerPercentage !== null ? ` · ${round.winnerPercentage}% winner share` : ""}`
    : round.prizeKind;
  const conclusionLabel = round.status === "drawn"
    ? "Drawn by"
    : round.status === "admin_cancelled"
      ? "Cancelled by"
      : round.status === "no_entry_cancelled"
        ? "Closed by"
        : "Concluded by";

  return `<dl style="display: grid; grid-template-columns: auto 1fr; gap: 0.55rem 1rem; margin: 0; color: #c9c5ba;">
    <dt>Status</dt><dd style="margin: 0;">${htmlText(roundStatusLabel(round))}</dd>
    ${attributionFact("Created by", round.createdBySubjectId, round.createdAt, attributions)}
    ${attributionFact("Updated by", round.updatedBySubjectId, round.updatedAt, attributions)}
    ${attributionFact("Made live by", round.liveBySubjectId, round.liveAt, attributions)}
    ${attributionFact(conclusionLabel, round.concludedBySubjectId, round.concludedAt, attributions)}
    <dt>Prize kind</dt><dd style="margin: 0;">${htmlText(prize)}</dd>
    <dt>Ticket price</dt><dd style="margin: 0;">${htmlText(round.ticketPriceGold)} gold</dd>
    <dt>Claims close</dt><dd style="margin: 0;">${localTime(raffleClaimCutoffUnix(round.drawingAtUnix))}</dd>
    <dt>Drawing deadline</dt><dd style="margin: 0;">${localTime(round.drawingAtUnix)}</dd>
    <dt>Total claims</dt><dd style="margin: 0;">${metrics.claimCount}</dd>
    <dt>Claim status</dt><dd style="margin: 0;">${metrics.pendingClaimCount} pending · ${metrics.approvedClaimCount} approved · ${metrics.cancelledClaimCount} cancelled · ${metrics.deniedClaimCount} denied</dd>
    <dt>Approved tickets</dt><dd style="margin: 0;">${metrics.approvedTicketCount}</dd>
    ${gold ? `<dt>Total pot</dt><dd style="margin: 0;">${gold.pot.toString()} gold</dd>` : ""}
    ${gold?.prize !== null && gold?.prize !== undefined ? `<dt>Prize value</dt><dd style="margin: 0;">${gold.prize.toString()} gold</dd>` : ""}
    ${round.totalEntries !== null ? `<dt>Final entries</dt><dd style="margin: 0;">${round.totalEntries}</dd>` : ""}
  </dl>`;
}

function managementSignals(round: RaffleAdministrationRound): string {
  if (round.status !== "live") return "";
  return `<p class="raffle-overview-participation">${round.approvedTicketCount} approved ${round.approvedTicketCount === 1 ? "ticket" : "tickets"}</p>`;
}

function operationalSignal(round: RaffleAdministrationRound): string {
  if (round.status !== "live") return "";
  if (round.pendingClaimCount > 0) {
    return `<p class="raffle-overview-attention"><strong>${round.pendingClaimCount} ${round.pendingClaimCount === 1 ? "claim needs" : "claims need"} review</strong></p>`;
  }
  return `<p class="raffle-overview-attention"><strong>No claims need review</strong></p>`;
}

function roundActions(round: RaffleRound): string {
  const viewPublic = round.status === "live"
    ? `<a class="raffle-action raffle-action-secondary" href="/events/raffle">View public raffle ↗</a>`
    : "";
  const primaryLabel = round.status === "live" ? "Manage raffle" : "Edit raffle";

  return `<div class="raffle-overview-actions">
    <a class="raffle-action raffle-action-primary" href="/admin/raffle/${htmlText(round.roundId)}">${primaryLabel}</a>
    ${viewPublic}
  </div>`;
}

function roundList(rounds: RaffleAdministrationRound[], attributions: AttributionLookup): string {
  if (rounds.length === 0) return `<p class="raffle-overview-empty">There are no live or upcoming raffles.</p>`;

  return `<div class="raffle-overview-list">
    ${rounds.map((round) => `
      <article class="raffle-overview-item raffle-overview-item-${round.status === "live" ? "live" : "upcoming"}">
        <div class="raffle-status-banner raffle-status-banner-${round.status === "live" ? "live" : "upcoming"}">
          <span>${round.status === "live" ? "Live" : "Upcoming"}</span>
        </div>
        <div class="raffle-overview-identity">
          <h2>Raffle</h2>
          <p>Drawing ${localTime(round.drawingAtUnix, "medium")}</p>
        </div>
        ${roundOverviewAttribution(round, attributions)}
        ${operationalSignal(round)}
        ${managementSignals(round)}
        ${roundActions(round)}
      </article>`).join("\n")}
  </div>`;
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
    <p style="margin: 0; color: #aaa69c; line-height: 1.55;">Creating a raffle prepares it only. Members will not see or participate in it until an attendant explicitly makes it live. New claims close automatically one hour before the drawing deadline.</p>
    <button type="submit" style="min-height: 3rem; padding: 0.7rem 1rem; border: 1px solid rgba(232,201,134,0.35); border-radius: 0.7rem; background: rgba(232,201,134,0.08); color: #e8c986; font-weight: 700;">Create raffle draft</button>
    <p data-raffle-admin-status aria-live="polite" style="min-height: 1.25rem; margin: 0; color: #aaa69c;"></p>
  </form>`;
}

function effectiveClaimStatus(claim: RaffleClaim, round: RaffleRound): string {
  if (claim.resolutionKind === "approved") return round.status === "admin_cancelled" ? "Approved · raffle later cancelled" : "Approved";
  if (claim.resolutionKind === "denied") return "Denied";
  if (claim.resolutionKind === "cancelled") return "Cancelled by claimant";
  if (round.status === "admin_cancelled") return "Unresolved when raffle cancelled";
  if (round.status === "drawn" || round.status === "no_entry_cancelled") return "Unresolved at closure";
  return "Awaiting attendant review";
}

function claimLedger(claims: RaffleClaim[], round: RaffleRound, attributions: AttributionLookup): string {
  if (claims.length === 0) return `<p style="color: #aaa69c;">No claims were submitted for this raffle.</p>`;
  return `<ol style="list-style: none; margin: 0; padding: 0; display: grid; gap: 1.25rem;">
    ${claims.map((claim) => {
      const resolutionAttribution = claimResolutionAttribution(claim, attributions);
      return `<li style="padding-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.07);"><div style="display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap;"><strong>${htmlText(claim.characterName)} · ${claim.requestedTicketCount} ${claim.requestedTicketCount === 1 ? "ticket" : "tickets"}</strong><span style="color: #aaa69c; font-size: 0.86rem;">${htmlText(effectiveClaimStatus(claim, round))}</span></div><p style="margin: 0.45rem 0 0; color: #c9c5ba; line-height: 1.55;">Promised deposit: ${htmlText(claim.promisedGoldValue)} gold · ${eventTime(claim.createdAt)}</p>${resolutionAttribution ? `<p style="margin: 0.4rem 0 0; color: #aaa69c;">${resolutionAttribution}</p>` : ""}${claim.denialReason ? `<p style="margin: 0.4rem 0 0; color: #c9c5ba;">Denial reason: ${htmlText(claim.denialReason)}</p>` : ""}</li>`;
    }).join("\n")}
  </ol>`;
}

function pendingClaims(claims: RaffleClaim[], round: RaffleRound): string {
  const pending = claims.filter((claim) => claim.resolutionKind === null);
  if (pending.length === 0) return `<p style="color: #aaa69c;">There are no claims awaiting review for this raffle.</p>`;
  return `<ol style="list-style: none; margin: 0; padding: 0; display: grid; gap: 1.5rem;">${pending.map((claim) => `<li style="padding-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.07);"><div style="display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap;"><strong>${htmlText(claim.characterName)}</strong><span style="color: #aaa69c; font-size: 0.86rem;">${eventTime(claim.createdAt)}</span></div><p style="margin: 0.45rem 0 0; color: #c9c5ba; line-height: 1.55;">${claim.requestedTicketCount} ${claim.requestedTicketCount === 1 ? "ticket" : "tickets"} · promised deposit ${htmlText(claim.promisedGoldValue)} gold</p>${round.status === "live" ? `<div style="display: grid; gap: 0.75rem; margin-top: 1rem;"><button type="button" data-approve-raffle-claim="${htmlText(claim.claimId)}" style="min-height: 2.7rem; padding: 0.65rem 0.85rem; border: 1px solid rgba(124,198,141,0.35); border-radius: 0.65rem; background: rgba(124,198,141,0.07); color: #b9dfc1; font-weight: 700;">Approve claim</button><label style="display: grid; gap: 0.4rem;"><span style="color: #c9c5ba; font-size: 0.9rem;">Denial reason</span><input data-raffle-denial-reason="${htmlText(claim.claimId)}" type="text" style="min-height: 2.8rem; padding: 0.65rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 0.65rem; background: #17181d; color: inherit;"></label><button type="button" data-deny-raffle-claim="${htmlText(claim.claimId)}" style="min-height: 2.7rem; padding: 0.65rem 0.85rem; border: 1px solid rgba(255,255,255,0.14); border-radius: 0.65rem; background: rgba(255,255,255,0.035); color: #d8d4ca;">Deny claim</button></div>` : `<p style="margin: 0.8rem 0 0; color: #aaa69c;">This raffle is not live, so its claims cannot be adjudicated.</p>`}</li>`).join("\n")}</ol>`;
}

function roundOperationalSummary(round: RaffleRound, metrics: ReturnType<typeof claimMetrics>): string {
  if (round.status === "live" && metrics.pendingClaimCount > 0) {
    return `<section aria-labelledby="raffle-attention-heading" style="margin-bottom: 2.5rem; padding: 1.15rem 1.25rem; border: 1px solid rgba(232,201,134,0.22); border-radius: 0.8rem; background: rgba(232,201,134,0.055);"><h2 id="raffle-attention-heading" style="margin-top: 0;">${metrics.pendingClaimCount} ${metrics.pendingClaimCount === 1 ? "claim needs" : "claims need"} review</h2><p style="margin-bottom: 0; color: #c9c5ba;">Resolve every pending claim before drawing this raffle.</p></section>`;
  }
  if (round.status === "live") {
    return `<section aria-labelledby="raffle-attention-heading" style="margin-bottom: 2.5rem; padding: 1.15rem 1.25rem; border: 1px solid rgba(124,198,141,0.18); border-radius: 0.8rem; background: rgba(124,198,141,0.045);"><h2 id="raffle-attention-heading" style="margin-top: 0;">No claims need review</h2><p style="margin-bottom: 0; color: #c9c5ba;">This raffle has no unresolved claims and can proceed to drawing when the attendant is ready.</p></section>`;
  }
  if (round.status === "created") {
    return `<section aria-labelledby="raffle-attention-heading" style="margin-bottom: 2.5rem; padding: 1.15rem 1.25rem; border: 1px solid rgba(255,255,255,0.08); border-radius: 0.8rem; background: rgba(255,255,255,0.02);"><h2 id="raffle-attention-heading" style="margin-top: 0;">Prepared raffle</h2><p style="margin-bottom: 0; color: #c9c5ba;">Review the raffle terms, then make it live when it is ready for member participation.</p></section>`;
  }
  return "";
}

async function adminContext(sessionToken: string | undefined) {
  const [viewer, subject] = await Promise.all([viewerForRequest(sessionToken), authenticatedSubject(sessionToken)]);
  const authorized = subject ? await subjectHasGuildCapability(subject.subjectId, RAFFLE_ADMIN_CAPABILITY) : false;
  return { viewer, subject, authorized };
}

export async function registerRaffleAdminPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/events/raffle/admin", async (_request, reply) => reply.code(308).header("Location", "/admin/raffle").send());
  app.get<{ Params: { roundId: string } }>("/events/raffle/admin/:roundId", async (request, reply) => reply.code(308).header("Location", `/admin/raffle/${encodeURIComponent(request.params.roundId)}`).send());

  app.get("/admin/raffle", async (request, reply) => {
    const { viewer, subject, authorized } = await adminContext(request.cookies[SESSION_COOKIE_NAME]);
    if (!authorized) {
      const html = renderPage(assets, { pathname: "/admin/raffle", title: "Raffle Administration · OH CRIT I Pulled! Guild Operations", viewer, header: `<div class="home-header-copy">${adminBreadcrumb()}</div>`, body: `<div style="width: min(100%, 46rem);">${sectionRule()}<h2>Raffle administration is not available for this account.</h2></div>` });
      return reply.code(subject ? 403 : 401).type("text/html; charset=utf-8").send(html);
    }
    const rounds = (await raffleRoundsForAdministration())
      .filter((round) => round.status === "live" || round.status === "created")
      .sort((a, b) => a.drawingAtUnix - b.drawingAtUnix);
    const attributions = await guildieAttributionsForSubjects(rounds.flatMap((round) => [
      round.createdBySubjectId,
      round.liveBySubjectId,
    ]));
    const html = renderPage(assets, {
      pathname: "/admin/raffle", title: "Raffle Administration · OH CRIT I Pulled! Guild Operations", description: "Operate the OH CRIT I Pulled! guild raffle.", viewer,
      header: `<div class="home-header-copy">${adminBreadcrumb()}</div>`,
      body: `<section class="raffle-admin-overview" aria-labelledby="raffle-overview-heading">
        <div class="raffle-overview-heading-row">
          <h1 class="raffle-overview-title" id="raffle-overview-heading">Raffle Overview</h1>
          <button class="raffle-start-button" type="button" data-toggle-raffle-setup>Start new raffle</button>
        </div>
        <div class="raffle-setup" data-raffle-setup hidden>${createRoundForm()}</div>
        ${roundList(rounds, attributions)}
      </section><script src="${assetUrl(assets, "raffle.js")}" defer></script>`,
    });
    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  });

  app.get<{ Params: { roundId: string } }>("/admin/raffle/:roundId", async (request, reply) => {
    const { viewer, subject, authorized } = await adminContext(request.cookies[SESSION_COOKIE_NAME]);
    const pathname = `/admin/raffle/${request.params.roundId}`;
    if (!authorized) return reply.code(subject ? 403 : 401).type("text/html; charset=utf-8").send(renderPage(assets, { pathname, title: "Raffle Administration · OH CRIT I Pulled! Guild Operations", viewer, header: `<div class="home-header-copy">${adminBreadcrumb()}<h1 id="page-title">Raffle</h1></div>`, body: `<div style="width: min(100%, 46rem);">${sectionRule()}<h2>Raffle administration is not available for this account.</h2></div>` }));
    const round = await raffleRound(request.params.roundId);
    if (!round) return reply.code(404).type("text/html; charset=utf-8").send(renderPage(assets, { pathname, title: "Raffle Not Found · OH CRIT I Pulled! Guild Operations", viewer, header: `<div class="home-header-copy">${adminBreadcrumb()}<h1 id="page-title">Raffle not found</h1></div>`, body: `<div style="width: min(100%, 46rem);">${sectionRule()}<p>This raffle does not exist.</p></div>` }));
    const claims = await raffleClaims(round.roundId);
    const attributions = await guildieAttributionsForSubjects([
      round.createdBySubjectId,
      round.updatedBySubjectId,
      round.liveBySubjectId,
      round.concludedBySubjectId,
      ...claims.flatMap((claim) => [
        claim.approvedBySubjectId,
        claim.deniedBySubjectId,
        claim.cancelledBySubjectId,
      ]),
    ]);
    const metrics = claimMetrics(claims);
    const terminal = round.status === "drawn" || round.status === "admin_cancelled" || round.status === "no_entry_cancelled";
    const drawControl = round.status === "live"
      ? metrics.pendingClaimCount === 0
        ? `<button type="button" data-draw-raffle-round="${htmlText(round.roundId)}" style="min-height: 2.6rem; padding: 0.6rem 0.85rem; border: 1px solid rgba(124,198,141,0.35); border-radius: 0.65rem; background: rgba(124,198,141,0.07); color: #b9dfc1; font-weight: 700;">Draw raffle</button>`
        : `<span style="color: #aaa69c; line-height: 1.45;">Resolve all pending claims before drawing.</span>`
      : "";
    const viewPublic = round.status === "live"
      ? `<a href="/events/raffle" style="display: inline-flex; min-height: 2.6rem; align-items: center; padding: 0.6rem 0.85rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 0.65rem; color: #c9c5ba; text-decoration: none;">View public raffle ↗</a>`
      : "";
    const controls = terminal ? "" : `<div style="display: flex; gap: 0.8rem; flex-wrap: wrap; align-items: center; margin-top: 1.25rem;">${round.status === "created" ? `<button type="button" data-activate-raffle-round="${htmlText(round.roundId)}" style="min-height: 2.6rem; padding: 0.6rem 0.85rem; border: 1px solid rgba(232,201,134,0.35); border-radius: 0.65rem; background: rgba(232,201,134,0.08); color: #e8c986; font-weight: 700;">Make raffle live</button>` : ""}${drawControl}${viewPublic}<button type="button" data-cancel-raffle-round="${htmlText(round.roundId)}" style="min-height: 2.6rem; padding: 0.6rem 0.85rem; border: 1px solid rgba(255,255,255,0.14); border-radius: 0.65rem; background: rgba(255,255,255,0.035); color: #d8d4ca;">Cancel raffle</button></div>`;
    const html = renderPage(assets, {
      pathname, title: "Raffle Administration · OH CRIT I Pulled! Guild Operations", description: "Review and operate a guild raffle.", viewer,
      header: `<div class="home-header-copy">${adminBreadcrumb(round)}<h1 id="page-title">Raffle management</h1><p class="lede">Drawing deadline: ${localTime(round.drawingAtUnix, "medium")}</p></div>`,
      body: `<div style="width: min(100%, 46rem);">${sectionRule()}${roundOperationalSummary(round, metrics)}<section aria-labelledby="raffle-facts-heading"><h2 id="raffle-facts-heading">Raffle facts</h2>${managementFacts(round, metrics, attributions)}${controls}</section>${round.status === "live" ? `<div style="margin-top: 2.5rem;">${sectionRule()}</div><section aria-labelledby="pending-claims-heading"><h2 id="pending-claims-heading">Pending claims</h2>${pendingClaims(claims, round)}</section>` : ""}<div style="margin-top: 2.5rem;">${sectionRule()}</div><section aria-labelledby="claim-ledger-heading"><h2 id="claim-ledger-heading">Claim ledger</h2><p style="color: #aaa69c; line-height: 1.55;">Every claim submitted to this raffle remains visible with the outcome established before the raffle closed.</p>${claimLedger(claims, round, attributions)}</section></div><script src="${assetUrl(assets, "raffle.js")}" defer></script>`,
    });
    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  });
}
