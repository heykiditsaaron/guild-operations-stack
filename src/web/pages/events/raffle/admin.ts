import type { FastifyInstance } from "fastify";
import { authenticatedSubject, SESSION_COOKIE_NAME } from "../../../../auth.js";
import { RAFFLE_ADMIN_CAPABILITY, subjectHasGuildCapability } from "../../../../guild-permissions.js";
import { raffleRoundsForAdministration } from "../../../../raffle/admin-view.js";
import type { RaffleRound } from "../../../../raffle/domain.js";
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

function roundSummary(round: RaffleRound): string {
  const split = round.prizeKind === "gold" && round.winnerPercentage !== null
    ? `${round.winnerPercentage}% winner share`
    : round.prizeKind;
  return `${htmlText(round.ticketPriceGold)} gold per ticket · ${htmlText(split)} · ${htmlText(drawingLabel(round.drawingAtUnix))}`;
}

function activeRounds(rounds: RaffleRound[]): string {
  if (rounds.length === 0) {
    return `<p style="color: #aaa69c;">There are no live raffles or prepared drafts.</p>`;
  }

  return `<ol style="list-style: none; margin: 0; padding: 0; display: grid; gap: 1.25rem;">
    ${rounds.map((round) => `
      <li style="padding-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.07);">
        <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap;">
          <strong>${round.status === "live" ? "Live raffle" : "Prepared draft"}</strong>
          <span style="color: #aaa69c; font-size: 0.86rem;">${htmlText(round.status)}</span>
        </div>
        <p style="margin: 0.45rem 0 0; color: #c9c5ba; line-height: 1.55;">${roundSummary(round)}</p>
        ${round.status === "created" ? `<button type="button" data-activate-raffle-round="${htmlText(round.roundId)}" style="margin-top: 0.8rem; min-height: 2.6rem; padding: 0.6rem 0.85rem; border: 1px solid rgba(232,201,134,0.35); border-radius: 0.65rem; background: rgba(232,201,134,0.08); color: #e8c986; font-weight: 700;">Make raffle live</button>` : `<a href="/events/raffle" style="display: inline-block; margin-top: 0.8rem;">View live raffle</a>`}
      </li>`).join("\n")}
  </ol>`;
}

function createRoundForm(): string {
  return `<form data-raffle-admin-create style="display: grid; gap: 1rem; margin-top: 1.25rem;">
    <label style="display: grid; gap: 0.4rem;">
      <span>Drawing guideline</span>
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

export async function registerRaffleAdminPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/events/raffle/admin", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, subject] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedSubject(sessionToken),
    ]);

    const authorized = subject
      ? await subjectHasGuildCapability(subject.subjectId, RAFFLE_ADMIN_CAPABILITY)
      : false;

    if (!authorized) {
      const html = renderPage(assets, {
        pathname: "/events/raffle/admin",
        title: "Raffle Administration · OH CRIT I Pulled! Guild Operations",
        viewer,
        header: `
          <div class="home-header-copy">
            <p class="eyebrow">Events · Raffle</p>
            <h1 id="page-title">Administration</h1>
          </div>`,
        body: `<div style="width: min(100%, 46rem);">${sectionRule()}<h2>Raffle administration is not available for this account.</h2></div>`,
      });
      return reply.code(subject ? 403 : 401).type("text/html; charset=utf-8").send(html);
    }

    const rounds = await raffleRoundsForAdministration();
    const html = renderPage(assets, {
      pathname: "/events/raffle/admin",
      title: "Raffle Administration · OH CRIT I Pulled! Guild Operations",
      description: "Operate the OH CRIT I Pulled! guild raffle.",
      viewer,
      header: `
        <div class="home-header-copy">
          <p class="eyebrow">Events · Raffle</p>
          <h1 id="page-title">Administration</h1>
          <p class="lede">Prepare and open the guild raffle.</p>
        </div>`,
      body: `
        <div style="width: min(100%, 46rem);">
          ${sectionRule()}
          <section aria-labelledby="current-rounds-heading">
            <h2 id="current-rounds-heading">Current rounds</h2>
            ${activeRounds(rounds)}
          </section>
          <div style="margin-top: 2.5rem;">${sectionRule()}</div>
          <section aria-labelledby="create-round-heading">
            <h2 id="create-round-heading">Prepare a raffle</h2>
            ${createRoundForm()}
          </section>
        </div>
        <script src="${assetUrl(assets, "raffle.js")}" defer></script>`,
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
