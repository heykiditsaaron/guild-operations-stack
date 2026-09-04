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
  return `<hr class="raffle-section-rule" aria-hidden="true">`;
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
  return `<dt>${htmlText(label)}</dt><dd>${actorName(subjectId, attributions)} · ${eventTime(at)}</dd>`;
}

function roundOverviewAttribution(round: RaffleAdministrationRound, attributions: AttributionLookup): string {
  if (round.status === "live" && round.liveBySubjectId) {
    return `<div class="raffle-overview-attribution"><span>Opened by <strong>${actorName(round.liveBySubjectId, attributions)}</strong></span></div>`;
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

  return `<dl class="raffle-facts">
    <dt>Status</dt><dd>${htmlText(roundStatusLabel(round))}</dd>
    ${attributionFact("Created by", round.createdBySubjectId, round.createdAt, attributions)}
    ${attributionFact("Updated by", round.updatedBySubjectId, round.updatedAt, attributions)}
    ${attributionFact("Opened by", round.liveBySubjectId, round.liveAt, attributions)}
    ${attributionFact(conclusionLabel, round.concludedBySubjectId, round.concludedAt, attributions)}
    <dt>Prize kind</dt><dd>${htmlText(prize)}</dd>
    <dt>Ticket price</dt><dd>${htmlText(round.ticketPriceGold)} gold</dd>
    <dt>Claims close</dt><dd>${localTime(raffleClaimCutoffUnix(round.drawingAtUnix))}</dd>
    <dt>Drawing deadline</dt><dd>${localTime(round.drawingAtUnix)}</dd>
    <dt>Total claims</dt><dd>${metrics.claimCount}</dd>
    <dt>Claim status</dt><dd>${metrics.pendingClaimCount} pending · ${metrics.approvedClaimCount} approved · ${metrics.cancelledClaimCount} cancelled · ${metrics.deniedClaimCount} denied</dd>
    <dt>Approved tickets</dt><dd>${metrics.approvedTicketCount}</dd>
    ${gold ? `<dt>Total pot</dt><dd>${gold.pot.toString()} gold</dd>` : ""}
    ${gold?.prize !== null && gold?.prize !== undefined ? `<dt>Prize value</dt><dd>${gold.prize.toString()} gold</dd>` : ""}
    ${round.totalEntries !== null ? `<dt>Final entries</dt><dd>${round.totalEntries}</dd>` : ""}
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
  return `<form class="raffle-setup-form" data-raffle-admin-create>
    <label class="raffle-setup-field">
      <span>Drawing deadline</span>
      <input data-raffle-admin-drawing type="datetime-local" required>
    </label>
    <label class="raffle-setup-field">
      <span>Ticket price (gold)</span>
      <input data-raffle-admin-price type="number" min="1" step="1" inputmode="numeric" required>
    </label>
    <label class="raffle-setup-field">
      <span>Winner share (%)</span>
      <input data-raffle-admin-winner-percentage type="number" min="1" max="100" step="1" value="50" inputmode="numeric" required>
    </label>
    <p class="raffle-setup-note">Creating a raffle prepares it only. Members will not see or participate in it until an attendant explicitly opens it. New claims close automatically one hour before the drawing deadline.</p>
    <button class="raffle-action raffle-action-primary" type="submit">Create raffle draft</button>
    <p class="raffle-setup-status" data-raffle-admin-status aria-live="polite"></p>
  </form>`;
}

function pendingRoundEditor(round: RaffleRound, attributions: AttributionLookup): string {
  const updated = round.updatedBySubjectId && round.updatedAt
    ? `<span>Last edited by <strong>${actorName(round.updatedBySubjectId, attributions)}</strong> · ${eventTime(round.updatedAt)}</span>`
    : "";
  return `<div class="raffle-edit">
    ${sectionRule()}
    <div class="raffle-status-banner raffle-status-banner-upcoming"><span>Upcoming</span></div>
    <form class="raffle-edit-form" data-raffle-admin-edit data-round-id="${htmlText(round.roundId)}" data-drawing-unix="${round.drawingAtUnix}">
      <label class="raffle-edit-field">
        <span>Drawing deadline</span>
        <input data-raffle-admin-drawing type="datetime-local" required>
      </label>
      <label class="raffle-edit-field">
        <span>Ticket price (gold)</span>
        <input data-raffle-admin-price type="number" min="1" step="1" inputmode="numeric" value="${htmlText(round.ticketPriceGold)}" required>
      </label>
      <label class="raffle-edit-field">
        <span>Winner share (%)</span>
        <input data-raffle-admin-winner-percentage type="number" min="1" max="100" step="1" inputmode="numeric" value="${round.winnerPercentage ?? 50}" required>
      </label>
      <p class="raffle-edit-note">Claims close automatically one hour before the drawing deadline. These terms remain editable until the raffle is opened.</p>
      <div class="raffle-edit-actions">
        <button class="raffle-action raffle-action-primary" type="submit">Save changes</button>
      </div>
      <p class="raffle-edit-status" data-raffle-admin-status aria-live="polite"></p>
    </form>
    <div class="raffle-edit-attribution">
      <span>Created by <strong>${actorName(round.createdBySubjectId, attributions)}</strong> · ${eventTime(round.createdAt)}</span>
      ${updated}
    </div>
    <section class="raffle-edit-transition" aria-labelledby="raffle-edit-open-heading">
      <h2 id="raffle-edit-open-heading">Ready for members?</h2>
      <p>Opening this raffle locks its terms and allows members to participate.</p>
      <div class="raffle-edit-actions">
        <button class="raffle-action raffle-action-primary" type="button" data-activate-raffle-round="${htmlText(round.roundId)}">Open raffle</button>
      </div>
    </section>
    <div class="raffle-edit-cancel">
      <button class="raffle-action raffle-action-tertiary" type="button" data-cancel-raffle-round="${htmlText(round.roundId)}">Cancel raffle</button>
    </div>
  </div>`;
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
  if (claims.length === 0) return `<p class="raffle-empty-note">No claims were submitted for this raffle.</p>`;
  return `<ol class="raffle-claim-ledger">
    ${claims.map((claim) => {
      const resolutionAttribution = claimResolutionAttribution(claim, attributions);
      return `<li class="raffle-claim-ledger-item">
        <div class="raffle-claim-heading">
          <strong>${htmlText(claim.characterName)} · ${claim.requestedTicketCount} ${claim.requestedTicketCount === 1 ? "ticket" : "tickets"}</strong>
          <span class="raffle-claim-status">${htmlText(effectiveClaimStatus(claim, round))}</span>
        </div>
        <p class="raffle-claim-meta">Promised deposit: ${htmlText(claim.promisedGoldValue)} gold · ${eventTime(claim.createdAt)}</p>
        ${resolutionAttribution ? `<p class="raffle-claim-resolution">${resolutionAttribution}</p>` : ""}
        ${claim.denialReason ? `<p class="raffle-claim-denial">Denial reason: ${htmlText(claim.denialReason)}</p>` : ""}
      </li>`;
    }).join("\n")}
  </ol>`;
}

function pendingClaims(claims: RaffleClaim[], round: RaffleRound): string {
  const pending = claims.filter((claim) => claim.resolutionKind === null);
  if (pending.length === 0) return `<p class="raffle-empty-note">There are no claims awaiting review for this raffle.</p>`;
  return `<ol class="raffle-claim-list">${pending.map((claim) => `<li class="raffle-claim-item">
    <div class="raffle-claim-heading">
      <strong>${htmlText(claim.characterName)}</strong>
      <span class="raffle-claim-time">${eventTime(claim.createdAt)}</span>
    </div>
    <p class="raffle-claim-meta">${claim.requestedTicketCount} ${claim.requestedTicketCount === 1 ? "ticket" : "tickets"} · promised deposit ${htmlText(claim.promisedGoldValue)} gold</p>
    ${round.status === "live" ? `<div class="raffle-claim-controls">
      <button class="raffle-action raffle-action-success" type="button" data-approve-raffle-claim="${htmlText(claim.claimId)}">Approve claim</button>
      <label class="raffle-claim-denial-field">
        <span>Denial reason</span>
        <input data-raffle-denial-reason="${htmlText(claim.claimId)}" type="text">
      </label>
      <button class="raffle-action raffle-action-secondary" type="button" data-deny-raffle-claim="${htmlText(claim.claimId)}">Deny claim</button>
    </div>` : `<p class="raffle-control-note">This raffle is not live, so its claims cannot be adjudicated.</p>`}
  </li>`).join("\n")}</ol>`;
}

function roundOperationalSummary(round: RaffleRound, metrics: ReturnType<typeof claimMetrics>): string {
  if (round.status === "live" && metrics.pendingClaimCount > 0) {
    return `<section class="raffle-operational-summary raffle-operational-summary-attention" aria-labelledby="raffle-attention-heading"><h2 id="raffle-attention-heading">${metrics.pendingClaimCount} ${metrics.pendingClaimCount === 1 ? "claim needs" : "claims need"} review</h2><p>Resolve every pending claim before drawing this raffle.</p></section>`;
  }
  if (round.status === "live") {
    return `<section class="raffle-operational-summary raffle-operational-summary-clear" aria-labelledby="raffle-attention-heading"><h2 id="raffle-attention-heading">No claims need review</h2><p>This raffle has no unresolved claims and can proceed to drawing when the attendant is ready.</p></section>`;
  }
  if (round.status === "created") {
    return `<section class="raffle-operational-summary raffle-operational-summary-prepared" aria-labelledby="raffle-attention-heading"><h2 id="raffle-attention-heading">Prepared raffle</h2><p>Review the raffle terms, then open it when it is ready for member participation.</p></section>`;
  }
  return "";
}

function liveRoundManager(
  round: RaffleRound,
  claims: RaffleClaim[],
  metrics: ReturnType<typeof claimMetrics>,
  attributions: AttributionLookup,
): string {
  const gold = round.prizeKind === "gold"
    ? goldMetrics(round.ticketPriceGold, round.winnerPercentage, metrics.approvedTicketCount)
    : null;
  const openedBy = round.liveBySubjectId && round.liveAt
    ? `<p class="raffle-live-attribution">Opened by <strong>${actorName(round.liveBySubjectId, attributions)}</strong> · ${eventTime(round.liveAt)}</p>`
    : "";
  const drawControl = metrics.pendingClaimCount === 0
    ? `<button class="raffle-action raffle-action-success" type="button" data-draw-raffle-round="${htmlText(round.roundId)}">Draw raffle</button>`
    : `<span class="raffle-control-note">Resolve all pending claims before drawing.</span>`;

  return `<div class="raffle-live-workspace">
    <div class="raffle-status-banner raffle-status-banner-live"><span>Live</span></div>
    ${roundOperationalSummary(round, metrics)}

    <section class="raffle-live-section" aria-labelledby="pending-claims-heading">
      <div class="raffle-live-section-heading">
        <div>
          <h2 id="pending-claims-heading">Claims needing review</h2>
          <p>${metrics.pendingClaimCount === 0 ? "Nothing needs officer attention right now." : "Confirm the promised bank deposit before approving each claim."}</p>
        </div>
        <span class="raffle-live-count">${metrics.pendingClaimCount}</span>
      </div>
      ${pendingClaims(claims, round)}
    </section>

    <section class="raffle-live-section" aria-labelledby="raffle-live-details-heading">
      <h2 id="raffle-live-details-heading">Raffle details</h2>
      <dl class="raffle-live-facts">
        <dt>Drawing deadline</dt><dd>${localTime(round.drawingAtUnix)}</dd>
        <dt>Claims close</dt><dd>${localTime(raffleClaimCutoffUnix(round.drawingAtUnix))}</dd>
        <dt>Ticket price</dt><dd>${htmlText(round.ticketPriceGold)} gold</dd>
        <dt>Winner share</dt><dd>${round.winnerPercentage === null ? "—" : `${round.winnerPercentage}%`}</dd>
        <dt>Approved tickets</dt><dd>${metrics.approvedTicketCount}</dd>
        ${gold ? `<dt>Current pot</dt><dd>${gold.pot.toString()} gold</dd>` : ""}
        ${gold?.prize !== null && gold?.prize !== undefined ? `<dt>Current prize</dt><dd>${gold.prize.toString()} gold</dd>` : ""}
      </dl>
      ${openedBy}
    </section>

    <section class="raffle-live-section" aria-labelledby="claim-ledger-heading">
      <h2 id="claim-ledger-heading">Claim ledger</h2>
      <p class="raffle-section-note">Every submitted claim remains visible with its current outcome.</p>
      ${claimLedger(claims, round, attributions)}
    </section>

    <section class="raffle-live-section raffle-live-actions" aria-labelledby="raffle-actions-heading">
      <h2 id="raffle-actions-heading">Raffle actions</h2>
      <p>Drawing concludes this raffle. Cancellation closes it without a winner.</p>
      <div class="raffle-management-controls">
        ${drawControl}
        <button class="raffle-action raffle-action-tertiary" type="button" data-cancel-raffle-round="${htmlText(round.roundId)}">Cancel raffle</button>
      </div>
    </section>
  </div>`;
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
      const html = renderPage(assets, {
        pathname: "/admin/raffle",
        title: "Raffle Administration · OH CRIT I Pulled! Guild Operations",
        viewer,
        header: `<div class="home-header-copy">${adminBreadcrumb()}</div>`,
        body: `<div class="raffle-admin-message">${sectionRule()}<h2>Raffle administration is not available for this account.</h2></div>`,
      });
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
      pathname: "/admin/raffle",
      title: "Raffle Administration · OH CRIT I Pulled! Guild Operations",
      description: "Operate the OH CRIT I Pulled! guild raffle.",
      viewer,
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
    if (!authorized) {
      return reply.code(subject ? 403 : 401).type("text/html; charset=utf-8").send(renderPage(assets, {
        pathname,
        title: "Raffle Administration · OH CRIT I Pulled! Guild Operations",
        viewer,
        header: `<div class="home-header-copy">${adminBreadcrumb()}</div>`,
        body: `<div class="raffle-admin-message">${sectionRule()}<h2>Raffle administration is not available for this account.</h2></div>`,
      }));
    }
    const round = await raffleRound(request.params.roundId);
    if (!round) {
      return reply.code(404).type("text/html; charset=utf-8").send(renderPage(assets, {
        pathname,
        title: "Raffle Not Found · OH CRIT I Pulled! Guild Operations",
        viewer,
        header: `<div class="home-header-copy">${adminBreadcrumb()}</div>`,
        body: `<div class="raffle-admin-message">${sectionRule()}<h2>Raffle not found</h2><p>This raffle does not exist.</p></div>`,
      }));
    }
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

    if (round.status === "created") {
      const html = renderPage(assets, {
        pathname,
        title: "Edit Raffle · OH CRIT I Pulled! Guild Operations",
        description: "Configure an upcoming guild raffle before it opens.",
        viewer,
        header: `<div class="home-header-copy">${adminBreadcrumb(round)}</div>`,
        body: `<section aria-labelledby="page-title">
          <div class="raffle-overview-heading-row">
            <h1 class="raffle-overview-title" id="page-title">Edit raffle</h1>
          </div>
          ${pendingRoundEditor(round, attributions)}
        </section><script src="${assetUrl(assets, "raffle.js")}" defer></script>`,
      });
      return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
    }

    const metrics = claimMetrics(claims);

    if (round.status === "live") {
      const html = renderPage(assets, {
        pathname,
        title: "Manage Raffle · OH CRIT I Pulled! Guild Operations",
        description: "Operate the currently live guild raffle.",
        viewer,
        header: `<div class="home-header-copy">${adminBreadcrumb(round)}</div>`,
        body: `<section class="raffle-live-page" aria-labelledby="page-title">
          <div class="raffle-overview-heading-row">
            <h1 class="raffle-overview-title" id="page-title">Manage raffle</h1>
            <a class="raffle-action raffle-action-secondary" href="/events/raffle">View public raffle ↗</a>
          </div>
          ${liveRoundManager(round, claims, metrics, attributions)}
        </section><script src="${assetUrl(assets, "raffle.js")}" defer></script>`,
      });
      return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
    }

    const terminal = round.status === "drawn" || round.status === "admin_cancelled" || round.status === "no_entry_cancelled";
    const controls = terminal ? "" : `<div class="raffle-management-controls"><button class="raffle-action raffle-action-tertiary" type="button" data-cancel-raffle-round="${htmlText(round.roundId)}">Cancel raffle</button></div>`;
    const html = renderPage(assets, {
      pathname,
      title: "Raffle Administration · OH CRIT I Pulled! Guild Operations",
      description: "Review a concluded guild raffle.",
      viewer,
      header: `<div class="home-header-copy">${adminBreadcrumb(round)}</div>`,
      body: `<section class="raffle-management" aria-labelledby="page-title"><div class="raffle-overview-heading-row"><h1 class="raffle-overview-title" id="page-title">Raffle record</h1></div>${sectionRule()}<section aria-labelledby="raffle-facts-heading"><h2 id="raffle-facts-heading">Raffle facts</h2>${managementFacts(round, metrics, attributions)}${controls}</section><div class="raffle-section-spacer">${sectionRule()}</div><section aria-labelledby="claim-ledger-heading"><h2 id="claim-ledger-heading">Claim ledger</h2><p class="raffle-section-note">Every claim submitted to this raffle remains visible with the outcome established before the raffle closed.</p>${claimLedger(claims, round, attributions)}</section></section><script src="${assetUrl(assets, "raffle.js")}" defer></script>`,
    });
    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  });
}
