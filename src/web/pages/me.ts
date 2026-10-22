import type { FastifyInstance } from "fastify";
import { authenticatedIdentity, SESSION_COOKIE_NAME } from "../../auth.js";
import { setIdentityDisplayName, setIdentityProfileIcon } from "../../core/identity/identity-presentation.js";
import { specializationProfileIconUrl, wowProfileIconChoices } from "../../wow-iconography.js";
import type { AssetRegistry } from "../assets.js";
import { htmlText, renderPage, type WebViewerCharacter } from "../render.js";
import { viewerForRequest } from "../viewer.js";
import { discordIdentityForWowIdentity } from "../../integrations/discord/identity.js";
import { discordIntegrationConfiguration } from "../../integrations/discord/configuration.js";

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
      <p class="me-character-card-context">${htmlText(realm)} · ${character.guildMember ? `${character.rankDisplayName ? `${character.rankDisplayName} · Rank ${character.rankIndex}` : `Rank ${character.rankIndex}`}` : "Not in this guild"}</p>
    </div>
  </article>`;
}

export async function registerMePage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  if (!app.hasContentTypeParser("application/x-www-form-urlencoded")) {
    app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
      const params = new URLSearchParams(typeof body === "string" ? body : body.toString("utf8"));
      done(null, Object.fromEntries(params.entries()));
    });
  }

  app.post("/me/display-name", async (request, reply) => {
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) return reply.code(401).send({ error: "not_authenticated" });
    const body = request.body as { display_name?: unknown };
    if (typeof body?.display_name !== "string") return reply.code(400).send({ error: "invalid_display_name" });
    try {
      await setIdentityDisplayName(identity.identityId, body.display_name);
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_display_name") {
        return reply.code(400).send({ error: "invalid_display_name" });
      }
      throw error;
    }
    return reply.redirect("/me");
  });

  app.post("/me/profile-icon", async (request, reply) => {
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) return reply.code(401).send({ error: "not_authenticated" });
    const body = request.body as { profile_icon_key?: unknown };
    if (typeof body?.profile_icon_key !== "string" || !await specializationProfileIconUrl(body.profile_icon_key)) {
      return reply.code(400).send({ error: "invalid_profile_icon" });
    }
    await setIdentityProfileIcon(identity.identityId, body.profile_icon_key);
    return reply.redirect("/me");
  });

  app.get("/me", async (request, reply) => {
    const viewer = await viewerForRequest(request.cookies[SESSION_COOKIE_NAME]);
    if (!viewer.authenticated) return reply.redirect("/auth/blizzard/start?return_to=%2Fme");

    const selected = viewer.mainCharacter;
    const sessionIdentity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!sessionIdentity) return reply.redirect("/auth/blizzard/start?return_to=%2Fme");
    const discordConfiguration = await discordIntegrationConfiguration();
    const discordIdentity = discordConfiguration?.enabled
      ? await discordIdentityForWowIdentity(sessionIdentity.identityId)
      : null;
    const profileIconChoices = await wowProfileIconChoices();
    const characters = viewer.controlledCharacters.map((character) =>
      characterCard(
        character,
        selected !== null &&
          selected.characterId === character.characterId &&
          selected.realmId === character.realmId,
      ),
    ).join("\n");

    const profileIcons = profileIconChoices.map((choice) => {
      const selectedIcon = viewer.identityProfileIconKey === choice.key;
      return `<label class="me-profile-icon-choice${selectedIcon ? " me-profile-icon-choice-selected" : ""}" title="${htmlText(`${choice.specName} ${choice.className}`)}">
        <input type="radio" name="profile_icon_key" value="${htmlText(choice.key)}"${selectedIcon ? " checked" : ""} required>
        <img src="${htmlText(choice.url)}" alt="">
        <span class="sr-only">${htmlText(`${choice.specName} ${choice.className}`)}</span>
      </label>`;
    }).join("\n");

    const defaultCharacter = selected
      ? `<div class="me-about-field">
          <div class="me-about-field-copy"><h3>Default Character</h3><p>Used when something needs to show you as a Character and you have not chosen one specifically.</p></div>
          <div class="me-default-character">
            ${selected.avatarUrl ? `<img class="me-default-character-avatar" src="${htmlText(selected.avatarUrl)}" alt="" referrerpolicy="no-referrer">` : ""}
            <strong>${htmlText(selected.name)}</strong>
          </div>
          <button type="button" class="button-secondary me-about-action" data-open-main-picker>Change default</button>
        </div>`
      : `<div class="me-about-field">
          <div class="me-about-field-copy"><h3>Default Character</h3><p>Choose the Character to use when something needs to show you as a Character and you have not chosen one specifically.</p></div>
          <p class="me-self-service-empty">No default Character selected.</p>
          <button type="button" class="button-secondary me-about-action" data-open-main-picker>Choose default</button>
        </div>`;

    const body = `
      <div class="me-self-service">
        <section class="me-self-service-card me-about-card">
          <div class="me-self-service-card-heading">
            <div><p class="eyebrow">About me</p><h2>About me</h2><p>Choose how you're shown in Guild Operations.</p></div>
          </div>
          <div class="me-identity-card">
            <button type="button" class="me-identity-card-icon" data-open-profile-icon-picker aria-label="Change profile icon">
              ${viewer.identityProfileIconUrl ? `<img src="${htmlText(viewer.identityProfileIconUrl)}" alt="">` : '<span class="me-profile-icon-placeholder" aria-hidden="true">?</span>'}
              <span class="me-identity-card-icon-edit" aria-hidden="true">✎</span>
            </button>
            <div class="me-identity-card-copy">
              <div class="me-identity-name-display" data-identity-name-display>
                <strong>${htmlText(viewer.identityLabel)}</strong>
                <button type="button" class="me-inline-edit" data-edit-display-name aria-label="Edit display name">Edit</button>
              </div>
              <form class="me-display-name-form me-display-name-form-inline" method="post" action="/me/display-name" data-display-name-form hidden>
                <input type="text" name="display_name" value="${htmlText(viewer.identityDisplayName ?? "")}" placeholder="${htmlText(viewer.identityLabel)}" maxlength="64" required aria-label="Display name">
                <div class="me-inline-edit-actions">
                  <button type="submit" class="button-primary">Save</button>
                  <button type="button" class="button-secondary" data-cancel-display-name>Cancel</button>
                </div>
              </form>
              ${viewer.guildRankIndex !== null ? `<span class="me-identity-card-standing">${htmlText(viewer.guildRankDisplayName ? `${viewer.guildRankDisplayName} · Rank ${viewer.guildRankIndex}` : `Rank ${viewer.guildRankIndex}`)}</span>` : ""}
            </div>
          </div>
          <dialog class="main-picker me-profile-icon-picker" data-profile-icon-picker aria-labelledby="profile-icon-picker-title">
            <div class="main-picker-sheet me-profile-icon-picker-sheet">
              <div class="main-picker-heading">
                <h2 id="profile-icon-picker-title">Profile icon</h2>
                <button type="button" class="dialog-close" data-close-profile-icon-picker aria-label="Close profile icon selection">×</button>
              </div>
              <p class="main-picker-section-copy">Choose a World of Warcraft icon to represent you in Guild Operations.</p>
              <form class="me-profile-icon-form" method="post" action="/me/profile-icon">
                <div class="me-profile-icon-choices">${profileIcons}</div>
                <button type="submit" class="button-primary">Use this icon</button>
              </form>
            </div>
          </dialog>
          ${defaultCharacter}
          ${discordConfiguration?.enabled ? `<div class="me-about-field">
            <div class="me-about-field-copy"><h3>Discord</h3><p>Connect a Discord Identity to use the same Guild Operations Actor when an allowed action originates in Discord.</p></div>
            ${discordIdentity
              ? `<div><strong>${htmlText(discordIdentity.username ?? "Discord user")}</strong><p class="me-self-service-empty">Discord ID ${htmlText(discordIdentity.discordUserId)} · Connected</p></div>`
              : '<div><p class="me-self-service-empty">No Discord account connected.</p><a class="button-secondary me-about-action" href="/integrations/discord/oauth/start">Connect Discord</a></div>'}
          </div>` : ""}
        </section>

        <section class="me-self-service-card">
          <div class="me-self-service-card-heading me-characters-heading">
            <div><p class="eyebrow">My Characters</p><h2>My Characters</h2><p>Characters currently controlled by your WoW Account. Guild membership is shown separately.</p></div>
            <button type="button" class="button-secondary" data-refresh-characters><span data-refresh-label>Refresh from Blizzard</span></button>
          </div>
          <div class="me-character-card-list">${characters || '<p class="me-self-service-empty">No currently controlled Characters were found.</p>'}</div>
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
        title: `Settings · ${viewer.guildPresentation.guildName} Guild Operations`,
        description: "Your Guild Operations settings and self-service area.",
        viewer,
        header: '<div><p class="eyebrow">Self service</p><h1 id="page-title">Settings</h1><p class="lede">Manage the parts of Guild Operations that belong to you.</p></div>',
        body,
      }));
  });
}
