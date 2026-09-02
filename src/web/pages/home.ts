import type { FastifyInstance } from "fastify";
import { authenticatedSubject, SESSION_COOKIE_NAME } from "../../auth.js";
import { discordAssociationForSubject } from "../../discord.js";
import { guildCharactersForSubject } from "../../guild.js";
import { mainCharacterForSubject } from "../../main-character.js";
import type { AssetRegistry } from "../assets.js";
import { renderPage, type WebViewer } from "../render.js";

async function viewerForHome(sessionToken: string | undefined): Promise<WebViewer> {
  const subject = await authenticatedSubject(sessionToken);
  if (!subject) return { authenticated: false };

  const [mainCharacter, characters, discordAssociation] = await Promise.all([
    mainCharacterForSubject(subject.subjectId),
    guildCharactersForSubject(subject.subjectId),
    discordAssociationForSubject(subject.subjectId),
  ]);

  return {
    authenticated: true,
    mainCharacter: mainCharacter
      ? {
          characterId: mainCharacter.characterId,
          realmId: mainCharacter.realmId,
          name: mainCharacter.name,
          avatarUrl: mainCharacter.avatarUrl,
        }
      : null,
    characters: characters.map((character) => ({
      characterId: character.characterId,
      realmId: character.realmId,
      name: character.name,
      realmName: character.realmName,
      rankIndex: character.rankIndex,
      level: character.level,
      className: character.className,
      raceName: character.raceName,
      activeSpecName: character.activeSpecName,
      avatarUrl: character.avatarUrl,
    })),
    discordAssociation: discordAssociation
      ? {
          username: discordAssociation.username,
        }
      : null,
  };
}

export async function registerHomePage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/", async (request, reply) => {
    const viewer = await viewerForHome(request.cookies[SESSION_COOKIE_NAME]);
    const html = renderPage(assets, {
      pathname: "/",
      title: "OH CRIT I Pulled! Guild Operations",
      description: "Guild operations and community participation for OH CRIT I Pulled!",
      viewer,
      header: `
        <div class="home-header-copy">
          <p class="eyebrow">Guild Operations</p>
          <h1 id="page-title">OH CRIT I Pulled!</h1>
          <p class="lede">The guild exists in Azeroth. This is where its operations continue outside the game.</p>
        </div>`,
      body: `
        <section class="home-panel" aria-labelledby="projection-status">
          <div class="status-line" id="projection-status">
            <span class="status-dot" aria-hidden="true"></span>
            <span>Web projection online</span>
          </div>
        </section>`,
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
