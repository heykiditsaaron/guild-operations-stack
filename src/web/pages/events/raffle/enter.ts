import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../../../auth.js";
import { raffleClaimCutoffUnix, raffleClaimsAreOpen, type RaffleRound } from "../../../../modules/raffle/domain.js";
import { liveRaffleRoundFacts } from "../../../../modules/raffle/queries.js";
import type { AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage, type WebViewer } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

function formatGold(value: string): string {
  return BigInt(value).toLocaleString("en-US");
}

function signedOutEntry(): string {
  return `<a class="raffle-action" href="/auth/blizzard/start?return_to=%2Fevents%2Fraffle%2Fenter">Sign in to enter</a>`;
}

function entryForm(round: RaffleRound, viewer: WebViewer): string {
  if (!raffleClaimsAreOpen(round.drawingAtUnix)) {
    return `<p class="raffle-status-copy">Entries are closed for this raffle. Officers will perform the drawing after any outstanding claims have been resolved.</p>`;
  }

  if (!viewer.authenticated) return signedOutEntry();

  const options = viewer.characters.map((character) => {
    const selected = viewer.mainCharacter !== null
      && viewer.mainCharacter.realmId === character.realmId
      && viewer.mainCharacter.characterId === character.characterId;
    const realm = character.realmName ?? `Realm ${character.realmId}`;
    return `<option data-realm-id="${htmlText(character.realmId)}" data-character-id="${htmlText(character.characterId)}"${selected ? " selected" : ""}>${htmlText(character.name)} — ${htmlText(realm)}</option>`;
  }).join("\n");

  if (!options) {
    return `<p class="raffle-status-copy">No currently eligible guild characters are available for a raffle claim.</p>`;
  }

  return `<form class="raffle-form" data-raffle-claim-form data-round-id="${htmlText(round.roundId)}" data-entry-price="${htmlText(round.entryPriceGold)}" data-claim-cutoff-unix="${raffleClaimCutoffUnix(round.drawingAtUnix)}">
    <label>
      <span>Character</span>
      <select data-raffle-character>${options}</select>
    </label>
    <label>
      <span>Entries requested</span>
      <input data-raffle-entry-count type="number" min="1" step="1" value="1" inputmode="numeric">
    </label>
    <p class="raffle-promise" data-raffle-promise></p>
    <p class="raffle-workspace-note">Submitting records your promise to deposit the shown gold into the guild bank. Your requested entries do not participate until an attendant confirms that deposit and approves the claim.</p>
    <button type="submit">Submit claim</button>
    <p class="raffle-form-status" data-raffle-claim-status aria-live="polite"></p>
  </form>`;
}

export async function registerRaffleEntryPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/events/raffle/enter", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, liveFacts] = await Promise.all([
      viewerForRequest(sessionToken),
      liveRaffleRoundFacts(),
    ]);
    const liveRaffle = liveFacts?.round ?? null;

    const body = liveRaffle
      ? `<section class="raffle-workspace" aria-labelledby="raffle-entry-title">
          <h2 id="raffle-entry-title">Enter to win</h2>
          <p class="raffle-workspace-intro">Entries are ${formatGold(liveRaffle.entryPriceGold)} gold each.</p>
          ${entryForm(liveRaffle, viewer)}
        </section>`
      : `<section class="raffle-workspace" aria-labelledby="raffle-entry-title"><h2 id="raffle-entry-title">No active raffle.</h2></section>`;

    const html = renderPage(assets, {
      pathname: "/events/raffle/enter",
      title: "Enter Raffle · OH CRIT I Pulled! Guild Operations",
      description: "Enter the current OH CRIT I Pulled! guild raffle.",
      viewer,
      secondaryNavigation: { kind: "back", label: "Back to raffle", href: "/events/raffle" },
      stylesheets: ["raffle.css"],
      scripts: ["raffle-entry.js"],
      header: `
        <div class="raffle-page-header">
          <p class="eyebrow">Events · Raffle</p>
          <h1 id="page-title">Enter</h1>
        </div>`,
      body,
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
