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
import type { AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage, type SecondaryNavigation } from "../../../render.js";
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

function adminNavigation(round?: RaffleRound): SecondaryNavigation {
  return {
    kind: "breadcrumb",
    items: round
      ? [
          { label: "Administration", href: "/admin" },
          { label: "Raffle", href: "/admin/raffle" },
          { label: `${new Date(round.drawingAtUnix * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} Raffle` },
        ]
      : [
          { label: "Administration", href: "/admin" },
          { label: "Raffle" },
        ],
  };
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
  const status = roundStatusLabel(round);
  const cutoffUnix = raffleClaimCutoffUnix(round.drawingAtUnix);
  const gold = round.prizeKind === "gold"
    ? goldMetrics(round.ticketPriceGold, round.winnerPercentage, metrics.approvedTicketCount)
    : null;

  return `<dl class="raffle-facts">
    <dt>Status</dt><dd>${htmlText(status)}</dd>
    <dt>Drawing</dt><dd>${localTime(round.drawingAtUnix)}</dd>
    <dt>Claim cutoff</dt><dd>${localTime(cutoffUnix)}</dd>
    <dt>Ticket price</dt><dd>${htmlText(round.ticketPriceGold)} gold</dd>
    <dt>Prize</dt><dd>${htmlText(round.prizeKind)}${round.winnerPercentage === null ? "" : ` · ${round.winnerPercentage}%`}</dd>
    <dt>Approved tickets</dt><dd>${metrics.approvedTicketCount}</dd>
    ${gold ? `<dt>Current pot</dt><dd>${gold.pot.toString()} gold</dd>` : ""}
    ${gold?.prize !== null && gold?.prize !== undefined ? `<dt>Current prize</dt><dd>${gold.prize.toString()} gold</dd>` : ""}
    ${attributionFact("Created", round.createdBySubjectId, round.createdAt, attributions)}
    ${attributionFact("Updated", round.updatedBySubjectId, round.updatedAt, attributions)}
    ${attributionFact("Opened", round.liveBySubjectId, round.liveAt, attributions)}
    ${attributionFact("Concluded", round.concludedBySubjectId, round.concludedAt, attributions)}
  </dl>`;
}

function createRoundForm(): string {
  return `<form class="raffle-setup-form" data-create-raffle-round>
    <label class="raffle-setup-field">
      <span>Estimated drawing time</span>
      <input name="drawingAt" type="datetime-local" required>
    </label>
    <label class="raffle-setup-field">
      <span>Ticket price (gold)</span>
      <input name="ticketPriceGold" type="number" min="1" step="1" required>
    </label>
    <label class="raffle-setup-field">
      <span>Prize kind</span>
      <input name="prizeKind" type="text" value="gold" required>
    </label>
    <label class="raffle-setup-field">
      <span>Winner percentage</span>
      <input name="winnerPercentage" type="number" min="1" max="100" step="1" value="50">
    </label>
    <p class="raffle-setup-note">The raffle remains upcoming until an authorized officer opens it.</p>
    <button class="raffle-action" type="submit">Create raffle</button>
    <p class="raffle-setup-status" data-raffle-setup-status aria-live="polite"></p>
  </form>`;
}

function pendingRoundEditor(round: RaffleRound, attributions: AttributionLookup): string {
  return `<div class="raffle-edit" data-raffle-round-id="${htmlText(round.roundId)}">
    <div class="raffle-status-banner raffle-status-banner-upcoming"><span>Upcoming</span></div>
    <form class="raffle-edit-form" data-edit-raffle-round>
      <label class="raffle-edit-field">
        <span>Estimated drawing time</span>
        <input name="drawingAt" type="datetime-local" data-unix-value="${round.drawingAtUnix}" required>
      </label>
      <label class="raffle-edit-field">
        <span>Ticket price (gold)</span>
        <input name="ticketPriceGold" type="number" min="1" step="1" value="${htmlText(round.ticketPriceGold)}" required>
      </label>
      <label class="raffle-edit-field">
        <span>Prize kind</span>
        <input name="prizeKind" type="text" value="${htmlText(round.prizeKind)}" required>
      </label>
      <label class="raffle-edit-field">
        <span>Winner percentage</span>
        <input name="winnerPercentage" type="number" min="1" max="100" step="1" value="${round.winnerPercentage ?? ""}">
      </label>
      <div class="raffle-edit-actions">
        <button class="raffle-action" type="submit">Save changes</button>
      </div>
      <p class="raffle-edit-status" data-raffle-edit-status aria-live="polite"></p>
    </form>
    <div class="raffle-edit-attribution">
      <span>Created by <strong>${actorName(round.createdBySubjectId, attributions)}</strong> · ${eventTime(round.createdAt)}</span>
      ${round.updatedBySubjectId && round.updatedAt ? `<span>Last updated by <strong>${actorName(round.updatedBySubjectId, attributions)}</strong> · ${eventTime(round.updatedAt)}</span>` : ""}
    </div>
    <section class="raffle-edit-transition" aria-labelledby="raffle-open-heading">
      <h2 id="raffle-open-heading">Open raffle</h2>
      <p>Opening makes this the guild's live raffle. Only one raffle may be live at a time.</p>
      <div class="raffle-management-controls">
        <button class="raffle-action raffle-action-success" type="button" data-open-raffle-round="${htmlText(round.roundId)}">Open raffle</button>
      </div>
    </section>
    <section class="raffle-edit-cancel" aria-labelledby="raffle-cancel-heading">
      <h2 id="raffle-cancel-heading">Cancel raffle</h2>
      <p class="raffle-section-note">Cancellation removes this upcoming raffle from current discovery while preserving its record.</p>
      <div class="raffle-management-controls">
        <button class="raffle-action raffle-action-cancel" type="button" data-cancel-raffle-round="${htmlText(round.roundId)}">Cancel raffle</button>
      </div>
    </section>
  </div>`;
}

function roundList(rounds: RaffleAdministrationRound[], attributions: AttributionLookup): string {
  if (rounds.length === 0) return `<p class="raffle-empty-note">No live or upcoming raffles.</p>`;

  return `<div class="raffle-overview-list">
    ${rounds.map((round) => {
      const live = round.status === "live";
      return `<article class="raffle-overview-item${live ? " raffle-overview-item-live" : ""}">
        <div class="raffle-status-banner raffle-status-banner-${live ? "live" : "upcoming"}"><span>${live ? "Live" : "Upcoming"}</span></div>
        <div class="raffle-overview-identity">
          <h2>${localTime(round.drawingAtUnix, "medium")}</h2>
          <p>Estimated drawing ${localTime(round.drawingAtUnix)}</p>
        </div>
        ${roundOverviewAttribution(round, attributions)}
        <p class="raffle-overview-attention"><strong>${round.pendingClaimCount === 0 ? "No claims need review" : `${round.pendingClaimCount} ${round.pendingClaimCount === 1 ? "claim needs" : "claims need"} review`}</strong></p>
        <p class="raffle-overview-participation">${round.approvedTicketCount} approved ${round.approvedTicketCount === 1 ? "ticket" : "tickets"}</p>
        <div class="raffle-management-controls">
          <a class="raffle-action" href="/admin/raffle/${encodeURIComponent(round.roundId)}">${live ? "Manage raffle" : "Edit raffle"}</a>
          ${live ? '<a class="raffle-action raffle-action-secondary" href="/events/raffle">View public raffle ↗</a>' : ""}
        </div>
      </article>`;
    }).join("\n")}
  </div>`;
}

function claimLedger(claims: RaffleClaim[], round: RaffleRound, attributions: AttributionLookup): string {
  if (claims.length === 0) return `<p class="raffle-empty-note">No claims were submitted for this raffle.</p>`;
  return `<ol class="raffle-claim-ledger">
    ${claims.map((claim) => {
      const state = claim.resolutionKind ?? (round.status === "live" ? "pending" : "unresolved");
      const resolutionAttribution = claimResolutionAttribution(claim, attributions);
      return `<li class="raffle-claim-ledger-item">
        <div class="raffle-claim-heading">
          <strong>${htmlText(claim.characterName)} · ${claim.requestedTicketCount} ${claim.requestedTicketCount === 1 ? "ticket" : "tickets"}</strong>
          <span class="raffle-claim-status raffle-claim-status-${htmlText(state)}">${htmlText(state)}</span>
        </div>
        <p class="raffle-claim-meta">Promised deposit: ${htmlText(claim.promisedGoldValue)} gold · submitted ${eventTime(claim.createdAt)}</p>
        ${resolutionAttribution ? `<p class="raffle-claim-resolution">${resolutionAttribution}</p>` : ""}
        ${claim.denialReason ? `<p class="raffle-claim-denial">Reason: ${htmlText(claim.denialReason)}</p>` : ""}
      </li>`;
    }).join("\n")}
  </ol>`;
}

function liveClaimCard(claim: RaffleClaim, attributions: AttributionLookup): string {
  const kind = claim.resolutionKind ?? "pending";
  const label = kind === "pending"
    ? "Pending"
    : kind === "approved"
      ? "Approved"
      : kind === "denied"
        ? "Denied"
        : "Cancelled";
  const resolutionAttribution = claimResolutionAttribution(claim, attributions);
  const controls = kind === "pending"
    ? `<div class="raffle-claim-controls">
        <button class="raffle-action raffle-action-success" type="button" data-approve-raffle-claim="${htmlText(claim.claimId)}">Approve claim</button>
        <label class="raffle-claim-denial-field">
          <span>Denial reason</span>
          <input data-raffle-denial-reason="${htmlText(claim.claimId)}" type="text">
        </label>
        <button class="raffle-action raffle-action-secondary" type="button" data-deny-raffle-claim="${htmlText(claim.claimId)}">Deny claim</button>
      </div>`
    : "";

  return `<li class="raffle-claim-card raffle-claim-card-${kind}">
    <div class="raffle-claim-heading">
      <strong>${htmlText(claim.characterName)} · ${claim.requestedTicketCount} ${claim.requestedTicketCount === 1 ? "ticket" : "tickets"}</strong>
      <span class="raffle-claim-status raffle-claim-status-${kind}">${label}</span>
    </div>
    <p class="raffle-claim-meta">Promised deposit: ${htmlText(claim.promisedGoldValue)} gold · submitted ${eventTime(claim.createdAt)}</p>
    ${resolutionAttribution ? `<p class="raffle-claim-resolution">${resolutionAttribution}</p>` : ""}
    ${claim.denialReason ? `<p class="raffle-claim-denial">Reason: ${htmlText(claim.denialReason)}</p>` : ""}
    ${controls}
  </li>`;
}

function liveClaimGroup(
  label: string,
  kind: Exclude<RaffleClaim["resolutionKind"], null>,
  claims: RaffleClaim[],
  attributions: AttributionLookup,
): string {
  const groupedClaims = claims.filter((claim) => claim.resolutionKind === kind);
  if (groupedClaims.length === 0) return "";

  return `<section class="raffle-claim-group" aria-labelledby="raffle-${kind}-claims-heading">
    <div class="raffle-claim-group-heading">
      <h3 id="raffle-${kind}-claims-heading">${label}</h3>
      <span class="raffle-claim-group-count">${groupedClaims.length}</span>
    </div>
    <ol class="raffle-claim-cards">
      ${groupedClaims.map((claim) => liveClaimCard(claim, attributions)).join("\n")}
    </ol>
  </section>`;
}

function liveClaims(claims: RaffleClaim[], attributions: AttributionLookup): string {
  if (claims.length === 0) return `<p class="raffle-empty-note">No claims have been submitted for this raffle.</p>`;

  const pending = claims.filter((claim) => claim.resolutionKind === null);
  const pendingGroup = pending.length === 0
    ? ""
    : `<section class="raffle-claim-group raffle-claim-group-pending" id="claims-needing-review" aria-labelledby="pending-claims-heading">
        <div class="raffle-claim-group-heading">
          <div>
            <h3 id="pending-claims-heading">Needs review</h3>
            <p>Confirm the promised bank deposit before approving each claim.</p>
          </div>
          <span class="raffle-claim-group-count">${pending.length}</span>
        </div>
        <ol class="raffle-claim-cards">
          ${pending.map((claim) => liveClaimCard(claim, attributions)).join("\n")}
        </ol>
      </section>`;

  return `${pendingGroup}
    ${liveClaimGroup("Approved", "approved", claims, attributions)}
    ${liveClaimGroup("Denied", "denied", claims, attributions)}
    ${liveClaimGroup("Cancelled", "cancelled", claims, attributions)}`;
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
  const attention = metrics.pendingClaimCount > 0
    ? `<a class="raffle-claim-attention raffle-claim-attention-active" href="#claims-needing-review"><strong>${metrics.pendingClaimCount} ${metrics.pendingClaimCount === 1 ? "claim needs" : "claims need"} attention</strong><span>View pending claims ↓</span></a>`
    : `<div class="raffle-claim-attention raffle-claim-attention-clear"><strong>No claims need attention</strong></div>`;

  return `<div class="raffle-live-workspace">
    <div class="raffle-status-banner raffle-status-banner-live"><span>Live</span></div>
    <section class="raffle-live-section raffle-live-details" aria-labelledby="raffle-details-heading">
      <h2 id="raffle-details-heading">Current raffle</h2>
      <dl class="raffle-live-facts">
        <dt>Drawing</dt><dd>${localTime(round.drawingAtUnix)}</dd>
        <dt>Claim cutoff</dt><dd>${localTime(raffleClaimCutoffUnix(round.drawingAtUnix))}</dd>
        <dt>Ticket price</dt><dd>${htmlText(round.ticketPriceGold)} gold</dd>
        <dt>Approved tickets</dt><dd>${metrics.approvedTicketCount}</dd>
        ${gold ? `<dt>Current pot</dt><dd>${gold.pot.toString()} gold</dd>` : ""}
        ${gold?.prize !== null && gold?.prize !== undefined ? `<dt>Current prize</dt><dd>${gold.prize.toString()} gold</dd>` : ""}
      </dl>
      ${openedBy}
    </section>

    <section class="raffle-live-section raffle-live-actions" aria-labelledby="raffle-actions-heading">
      <h2 id="raffle-actions-heading">Raffle actions</h2>
      <p>Drawing concludes this raffle. Cancellation closes it without a winner.</p>
      <div class="raffle-management-controls">
        ${drawControl}
        <button class="raffle-action raffle-action-cancel" type="button" data-cancel-raffle-round="${htmlText(round.roundId)}">Cancel raffle</button>
      </div>
      ${attention}
    </section>

    <section class="raffle-live-section raffle-live-claims" aria-labelledby="raffle-claims-heading">
      <h2 id="raffle-claims-heading">Claims</h2>
      ${liveClaims(claims, attributions)}
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
        secondaryNavigation: adminNavigation(),
        stylesheets: ["raffle-admin.css"],
        header: "",
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
      secondaryNavigation: adminNavigation(),
      stylesheets: ["raffle-admin.css"],
      scripts: ["raffle.js"],
      header: "",
      body: `<section class="raffle-admin-overview" aria-labelledby="raffle-overview-heading">
        <div class="raffle-overview-heading-row">
          <h1 class="raffle-overview-title" id="raffle-overview-heading">Raffle Overview</h1>
          <button class="raffle-start-button" type="button" data-toggle-raffle-setup>Start new raffle</button>
        </div>
        <div class="raffle-setup" data-raffle-setup hidden>${createRoundForm()}</div>
        ${roundList(rounds, attributions)}
      </section>`,
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
        secondaryNavigation: adminNavigation(),
        stylesheets: ["raffle-admin.css"],
        header: "",
        body: `<div class="raffle-admin-message">${sectionRule()}<h2>Raffle administration is not available for this account.</h2></div>`,
      }));
    }
    const round = await raffleRound(request.params.roundId);
    if (!round) {
      return reply.code(404).type("text/html; charset=utf-8").send(renderPage(assets, {
        pathname,
        title: "Raffle Not Found · OH CRIT I Pulled! Guild Operations",
        viewer,
        secondaryNavigation: adminNavigation(),
        stylesheets: ["raffle-admin.css"],
        header: "",
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
        secondaryNavigation: adminNavigation(round),
        stylesheets: ["raffle-admin.css"],
        scripts: ["raffle.js"],
        header: "",
        body: `<section aria-labelledby="page-title">
          <div class="raffle-overview-heading-row">
            <h1 class="raffle-overview-title" id="page-title">Edit raffle</h1>
          </div>
          ${pendingRoundEditor(round, attributions)}
        </section>`,
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
        secondaryNavigation: adminNavigation(round),
        stylesheets: ["raffle-admin.css"],
        scripts: ["raffle.js"],
        header: "",
        body: `<section class="raffle-live-page" aria-labelledby="page-title">
          <div class="raffle-overview-heading-row">
            <h1 class="raffle-overview-title" id="page-title">Manage raffle</h1>
            <a class="raffle-action raffle-action-secondary" href="/events/raffle">View public raffle ↗</a>
          </div>
          ${liveRoundManager(round, claims, metrics, attributions)}
        </section>`,
      });
      return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
    }

    const terminal = round.status === "drawn" || round.status === "admin_cancelled" || round.status === "no_entry_cancelled";
    const controls = terminal ? "" : `<div class="raffle-management-controls"><button class="raffle-action raffle-action-cancel" type="button" data-cancel-raffle-round="${htmlText(round.roundId)}">Cancel raffle</button></div>`;
    const html = renderPage(assets, {
      pathname,
      title: "Raffle Administration · OH CRIT I Pulled! Guild Operations",
      description: "Review a concluded guild raffle.",
      viewer,
      secondaryNavigation: adminNavigation(round),
      stylesheets: ["raffle-admin.css"],
      scripts: ["raffle.js"],
      header: "",
      body: `<section class="raffle-management" aria-labelledby="page-title"><div class="raffle-overview-heading-row"><h1 class="raffle-overview-title" id="page-title">Raffle record</h1></div>${sectionRule()}<section aria-labelledby="raffle-facts-heading"><h2 id="raffle-facts-heading">Raffle facts</h2>${managementFacts(round, metrics, attributions)}${controls}</section><div class="raffle-section-spacer">${sectionRule()}</div><section aria-labelledby="claim-ledger-heading"><h2 id="claim-ledger-heading">Claim ledger</h2><p class="raffle-section-note">Every claim submitted to this raffle remains visible with the outcome established before the raffle closed.</p>${claimLedger(claims, round, attributions)}</section></section>`,
    });
    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  });
}