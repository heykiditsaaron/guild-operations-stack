import type { FastifyInstance } from "fastify";
import { authenticatedSubject, SESSION_COOKIE_NAME } from "../../../../auth.js";
import { RAFFLE_ADMIN_CAPABILITY, subjectHasGuildCapability } from "../../../../guild-permissions.js";
import type { RaffleRound } from "../../../../raffle/domain.js";
import { activeRaffleRound } from "../../../../raffle/live-round.js";
import { raffleClaimsForMember, type RaffleMemberClaim } from "../../../../raffle/member-view.js";
import { assetUrl, type AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage, type WebViewer } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

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

function prizeLabel(round: RaffleRound): string {
  if (round.prizeKind === "gold" && round.winnerPercentage !== null) {
    if (round.winnerPercentage === 100) return "100% of the raffle pot goes to the winner.";
    return `${round.winnerPercentage}% of the raffle pot goes to the winner; the remainder stays with the guild bank.`;
  }

  return `Prize: ${round.prizeKind}.`;
}

function sectionRule(): string {
  return `<hr aria-hidden="true" style="margin: 0 0 2.5rem; border: 0; border-top: 1px solid rgba(238, 201, 124, 0.18);">`;
}

function claimResolution(claim: RaffleMemberClaim): string {
  if (claim.resolutionKind === "approved") return "Approved · chances established";
  if (claim.resolutionKind === "denied") return "Denied";
  if (claim.resolutionKind === "cancelled") return "Cancelled";
  return "Awaiting attendant review";
}

function memberClaims(claims: RaffleMemberClaim[]): string {
  if (claims.length === 0) {
    return `<p style="color: #aaa69c;">You have not submitted a claim for this raffle.</p>`;
  }

  return `<ol style="list-style: none; margin: 0; padding: 0; display: grid; gap: 1.25rem;">
    ${claims.map((claim) => `
      <li style="padding-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.07);">
        <div style="display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; flex-wrap: wrap;">
          <strong>${htmlText(claim.characterName)} · ${claim.requestedTicketCount} ${claim.requestedTicketCount === 1 ? "ticket" : "tickets"}</strong>
          <span style="color: #aaa69c; font-size: 0.86rem;">${htmlText(claimResolution(claim))}</span>
        </div>
        <p style="margin: 0.4rem 0 0; color: #c9c5ba;">Promised deposit: ${htmlText(claim.promisedGoldValue)} gold · ${htmlText(claimTimeLabel(claim.createdAt))}</p>
        ${claim.denialReason ? `<p style="margin: 0.4rem 0 0; color: #c9c5ba;">Reason: ${htmlText(claim.denialReason)}</p>` : ""}
        ${claim.resolutionKind === null ? `<button type="button" data-cancel-raffle-claim="${htmlText(claim.claimId)}" style="margin-top: 0.7rem; min-height: 2.5rem; padding: 0.55rem 0.8rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 0.65rem; background: rgba(255,255,255,0.035); color: inherit;">Cancel claim</button>` : ""}
      </li>`).join("\n")}
  </ol>`;
}

function participation(round: RaffleRound, viewer: WebViewer, claims: RaffleMemberClaim[]): string {
  if (!viewer.authenticated) {
    return `
      <section aria-labelledby="participate-heading">
        <h2 id="participate-heading">Participate</h2>
        <p>Sign in with Blizzard to submit a raffle claim as one of your current guild characters.</p>
        <a href="/auth/blizzard/start?return_to=%2Fevents%2Fraffle">Sign in to participate</a>
      </section>`;
  }

  const options = viewer.characters.map((character) => {
    const selected = viewer.mainCharacter !== null
      && viewer.mainCharacter.realmId === character.realmId
      && viewer.mainCharacter.characterId === character.characterId;
    const realm = character.realmName ?? `Realm ${character.realmId}`;
    return `<option data-realm-id="${htmlText(character.realmId)}" data-character-id="${htmlText(character.characterId)}"${selected ? " selected" : ""}>${htmlText(character.name)} — ${htmlText(realm)}</option>`;
  }).join("\n");

  const form = options
    ? `<form data-raffle-claim-form data-round-id="${htmlText(round.roundId)}" data-ticket-price="${htmlText(round.ticketPriceGold)}" style="display: grid; gap: 1rem; margin-top: 1.25rem;">
        <label style="display: grid; gap: 0.4rem;">
          <span>Character</span>
          <select data-raffle-character style="min-height: 3rem; padding: 0.65rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 0.65rem; background: #17181d; color: inherit;">${options}</select>
        </label>
        <label style="display: grid; gap: 0.4rem;">
          <span>Tickets requested</span>
          <input data-raffle-ticket-count type="number" min="1" step="1" value="1" inputmode="numeric" style="min-height: 3rem; padding: 0.65rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 0.65rem; background: #17181d; color: inherit;">
        </label>
        <p data-raffle-promise style="margin: 0; color: #c9c5ba;"></p>
        <p style="margin: 0; color: #aaa69c; line-height: 1.55;">Submitting records your promise to deposit the shown gold into the guild bank. Your requested tickets do not participate until an attendant confirms that deposit and approves the claim.</p>
        <button type="submit" style="min-height: 3rem; padding: 0.7rem 1rem; border: 1px solid rgba(232,201,134,0.35); border-radius: 0.7rem; background: rgba(232,201,134,0.08); color: #e8c986; font-weight: 700;">Submit claim</button>
        <p data-raffle-claim-status aria-live="polite" style="min-height: 1.25rem; margin: 0; color: #aaa69c;"></p>
      </form>`
    : `<p style="color: #aaa69c;">No currently eligible guild characters are available for a raffle claim.</p>`;

  return `
    <section aria-labelledby="participate-heading">
      <h2 id="participate-heading">Participate</h2>
      ${form}
    </section>
    <div style="margin-top: 2.5rem;">${sectionRule()}</div>
    <section aria-labelledby="your-claims-heading">
      <h2 id="your-claims-heading">Your claims</h2>
      ${memberClaims(claims)}
    </section>`;
}

function liveRoundBody(round: RaffleRound, viewer: WebViewer, claims: RaffleMemberClaim[]): string {
  return `
    <div style="width: min(100%, 46rem);">
      ${sectionRule()}
      <section aria-labelledby="raffle-status">
        <div class="status-line" id="raffle-status">
          <span class="status-dot" aria-hidden="true"></span>
          <span>Raffle live</span>
        </div>
        <h2>${htmlText(round.ticketPriceGold)} gold per ticket</h2>
        <p class="lede">${htmlText(prizeLabel(round))}</p>
        <p>Drawing guideline: <strong>${htmlText(drawingLabel(round.drawingAtUnix))}</strong></p>
        <p>The drawing time is informational. The raffle remains live until an attendant concludes it.</p>
      </section>
      <div style="margin-top: 2.5rem;">${sectionRule()}</div>
      ${participation(round, viewer, claims)}
    </div>`;
}

function noLiveRoundBody(): string {
  return `
    <div style="width: min(100%, 46rem);">
      ${sectionRule()}
      <section aria-labelledby="raffle-status">
        <h2 id="raffle-status">No raffle is live right now.</h2>
        <p class="lede">When the guild opens a raffle, its current terms will appear here.</p>
      </section>
    </div>`;
}

export async function registerRafflePage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/events/raffle", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, subject, liveRaffle] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedSubject(sessionToken),
      activeRaffleRound(),
    ]);
    const [claims, isAdmin] = await Promise.all([
      subject && liveRaffle
        ? raffleClaimsForMember(subject.subjectId, liveRaffle.roundId)
        : Promise.resolve([]),
      subject
        ? subjectHasGuildCapability(subject.subjectId, RAFFLE_ADMIN_CAPABILITY)
        : Promise.resolve(false),
    ]);

    const manageRaffles = isAdmin
      ? `<div style="margin-top: calc(-1 * clamp(2rem, 8vw, 5.5rem)); margin-bottom: clamp(2rem, 6vw, 3rem); font-size: 0.88rem;"><a href="/events/raffle/admin" style="color: #c9c5ba;">Manage Raffles</a></div>`
      : "";
    const raffleScript = `<script src="${assetUrl(assets, "raffle.js")}" defer></script>`;
    const html = renderPage(assets, {
      pathname: "/events/raffle",
      title: "Raffle · OH CRIT I Pulled! Guild Operations",
      description: "Current OH CRIT I Pulled! guild raffle information.",
      viewer,
      header: `
        ${manageRaffles}
        <div class="home-header-copy">
          <p class="eyebrow">Events</p>
          <h1 id="page-title">Raffle</h1>
          <p class="lede">The guild raffle, operated and preserved through Guild Operations.</p>
        </div>`,
      body: `${liveRaffle ? liveRoundBody(liveRaffle, viewer, claims) : noLiveRoundBody()}${raffleScript}`,
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
