import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../auth.js";
import type { AssetRegistry } from "../assets.js";
import { htmlText, renderPage, type WebViewerCharacter } from "../render.js";
import { viewerForRequest } from "../viewer.js";

function characterRole(character: WebViewerCharacter): string {
  if (character.activeSpecName && character.className) return `${character.activeSpecName} ${character.className}`;
  return character.className ?? character.activeSpecName ?? character.raceName ?? "Character";
}

function characterCard(character: WebViewerCharacter, selected: boolean): string {
  const realm = character.realmName ?? `Realm ${character.realmId}`;
  const portrait = character.avatarUrl
    ? `<img src="${htmlText(character.avatarUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="me-character-card-placeholder" aria-hidden="true">?</span>`;
  return `<article class="me-character-card${selected ? " me-character-card-main" : ""}">
    <div class="me-character-card-portrait">${portrait}</div>
    <div class="me-character-card-copy">
      <div class="me-character-card-heading"><h3>${htmlText(character.name)}</h3>${selected ? '<span class="me-character-card-badge">Main</span>' : ""}</div>
      <p>${htmlText(characterRole(character))}</p>
      <p class="me-character-card-context">${htmlText(realm)} · Guild rank ${character.rankIndex}</p>
    </div>
  </article>`;
}

export async function registerMePage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/me", async (request, reply) => {
    const viewer = await viewerForRequest(request.cookies[SESSION_COOKIE_NAME]);
    if (!viewer.authenticated) return reply.redirect("/auth/blizzard/start?return_to=%2Fme");

    const selected = viewer.mainCharacter;
    const characters = viewer.characters.map((character) =>
      characterCard(
        character,
        selected !== null &&
          selected.characterId === character.characterId &&
          selected.realmId === character.realmId,
      ),
    ).join("\n");

    const representation = selected
      ? `<div class="me-self-service-summary">
          ${selected.avatarUrl ? `<img class="me-self-service-avatar" src="${htmlText(selected.avatarUrl)}" alt="" referrerpolicy="no-referrer">` : ""}
          <div><p class="eyebrow">Character representation</p><h2>${htmlText(selected.name)}</h2><p>Your main Character is the fallback Guild Operations uses when it needs to represent you as a Character and you have not made a more specific choice.</p></div>
        </div>`
      : `<div><p class="eyebrow">Character representation</p><h2>No main Character selected</h2><p>Choose the Character Guild Operations should use when it needs a Character representation and you have not made a more specific choice.</p></div>`;

    const body = `
      <div class="me-self-service">
        <section class="me-self-service-card me-self-service-representation">
          ${representation}
          <div class="me-self-service-actions">
            <button type="button" class="button-primary" data-open-main-picker>Manage Characters</button>
            <button type="button" class="button-secondary" data-refresh-characters><span data-refresh-label>Refresh from Blizzard</span></button>
          </div>
        </section>

        <section class="me-self-service-card">
          <div class="me-self-service-card-heading">
            <div><p class="eyebrow">My Characters</p><h2>Guild Characters</h2><p>Characters you currently control that are present in this guild.</p></div>
          </div>
          <div class="me-character-card-list">${characters || '<p class="me-self-service-empty">No currently eligible guild Characters were found.</p>'}</div>
        </section>

        <section class="me-self-service-card me-self-service-destination">
          <div><p class="eyebrow">Activities</p><h2>My Participation</h2><p>Review your Activity Participation and outstanding Participation Offers across the guild.</p></div>
          <a class="button-secondary" href="/me/participation">View My Participation</a>
        </section>
      </div>`;

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(renderPage(assets, {
        pathname: "/me",
        title: `Me · ${viewer.guildPresentation.guildName} Guild Operations`,
        description: "Your Guild Operations self-service area.",
        viewer,
        header: '<div><p class="eyebrow">Self service</p><h1 id="page-title">Me</h1><p class="lede">Manage the parts of Guild Operations that belong to you.</p></div>',
        body,
      }));
  });
}
