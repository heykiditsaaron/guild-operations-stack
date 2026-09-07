import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../auth.js";
import type { AssetRegistry } from "../assets.js";
import { renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

const effectiveDate = "September 7, 2026";

function documentHeader(title: string, summary: string): string {
  return `<div class="site-document-header">
    <p class="eyebrow">OH CRIT I Pulled!</p>
    <h1>${title}</h1>
    <p class="lede">${summary}</p>
  </div>`;
}

function privacyBody(): string {
  return `<article class="site-document">
    <p class="site-document-effective">Effective ${effectiveDate}</p>

    <section>
      <h2>About this site</h2>
      <p>This website supports participation in the World of Warcraft guild OH CRIT I Pulled!. It is privately operated for the guild and is not operated by, sponsored by, or affiliated with Blizzard Entertainment or Discord.</p>
    </section>

    <section>
      <h2>Information we use</h2>
      <p>When you sign in with Blizzard, the site uses Blizzard account authority and World of Warcraft information needed to establish who you are in the guild. This can include your Blizzard account identifier, WoW account identifiers, characters you control, character names and realms, guild membership and rank, and character presentation information such as class, specialization, level, race, and avatar.</p>
      <p>The site also stores guild-specific information created here, including your selected main character and records needed to operate guild activities. For example, raffle participation can record the character used, requested ticket count, promised gold value, and the outcome of the claim.</p>
    </section>

    <section>
      <h2>Discord</h2>
      <p>Connecting Discord is optional. If you choose to connect it, the site requests Discord's basic <code>identify</code> permission and stores your Discord user ID, username, and the time the association was established. The association may be used to express guild-managed roles in Discord. Guild Operations does not use Discord as the source of your canonical guild identity.</p>
    </section>

    <section>
      <h2>Sessions and cookies</h2>
      <p>After successful Blizzard authentication, the site sets a first-party session cookie so it can recognize your authenticated session. The cookie is HTTP-only and uses SameSite=Lax. Session records store a cryptographic hash of the session token rather than the token itself and expire after the configured session lifetime.</p>
    </section>

    <section>
      <h2>Operational records</h2>
      <p>Guild Operations records useful results from some administrative and member operations so authorized guild administrators can inspect what the application did and whether it succeeded. These records can include the guild member responsible for an operation, its result, timestamps, and useful failure information. Routine framework request logging is disabled so OAuth authorization codes and state values in callback URLs are not written to normal request logs.</p>
    </section>

    <section>
      <h2>External services</h2>
      <p>The site communicates with Blizzard to authenticate accounts and obtain Blizzard-owned World of Warcraft information. If you connect Discord, it communicates with Discord to establish that association and may use the guild's Discord integration to manage guild-defined roles. Links to Blizzard, Raider.IO, Warcraft Logs, and Discord take you to services with their own privacy practices.</p>
    </section>

    <section>
      <h2>How information is used</h2>
      <p>Information held by Guild Operations is used to establish authority to participate, enable and operate guild participation, present useful guild context, and preserve relevant guild activity and operational history. It is not collected to build a general-purpose public profile.</p>
    </section>

    <section>
      <h2>Changes</h2>
      <p>This application evolves with the guild. This policy may be updated when the information the site uses or the ways it participates with external services materially change. The effective date above identifies the current version.</p>
    </section>
  </article>`;
}

function termsBody(): string {
  return `<article class="site-document">
    <p class="site-document-effective">Effective ${effectiveDate}</p>

    <section>
      <h2>Purpose</h2>
      <p>Guild Operations exists to support participation in OH CRIT I Pulled! outside World of Warcraft while remaining connected to the guild's activity in WoW and Discord. It is a private guild service, not a Blizzard Entertainment or Discord service.</p>
    </section>

    <section>
      <h2>Using Guild Operations</h2>
      <p>Features may depend on current guild membership, Blizzard-authenticated control of eligible characters, guild rank, or capabilities established by the guild. Access to a page or feature does not create guild authority that you do not otherwise have.</p>
      <p>You agree not to misuse the site, interfere with its operation, attempt to act as another guild member, or deliberately provide false information in guild activities.</p>
    </section>

    <section>
      <h2>Guild decisions remain guild decisions</h2>
      <p>Guild Operations can automate procedures, enforcement, recording, resolution, and presentation, but it does not replace human judgment where guild leadership or members are the proper authority. Guild rules, leadership decisions, raid decisions, prizes, participation decisions, and similar guild matters remain subject to the people responsible for them.</p>
    </section>

    <section>
      <h2>World of Warcraft and external services</h2>
      <p>Blizzard remains authoritative for Blizzard-owned facts such as authenticated account control, characters, current guild membership, and numeric guild rank. Discord remains responsible for its own service. Raider.IO, Warcraft Logs, and other linked services are independent services. Their availability, data, and terms are outside Guild Operations' control.</p>
    </section>

    <section>
      <h2>Guild activities</h2>
      <p>Individual activities can have their own rules and eligibility requirements. Those activity-specific rules govern participation in that activity in addition to these terms. Using Guild Operations does not guarantee a raid spot, event place, raffle prize, guild rank, or any other discretionary guild outcome.</p>
    </section>

    <section>
      <h2>Availability and changes</h2>
      <p>This is a privately operated guild application. Features may change, be unavailable, or be retired as the guild's needs change. Access may also change when Blizzard-observed membership or guild-granted authority changes.</p>
    </section>

    <section>
      <h2>Account authority</h2>
      <p>Blizzard authentication is used to establish authority over the relevant Blizzard account and controlled characters. A selected main character is a presentation preference; selecting one does not transfer identity, ownership, membership, rank, or permissions.</p>
    </section>

    <section>
      <h2>Changes to these terms</h2>
      <p>These terms may be updated as Guild Operations gains or changes concrete guild participation capabilities. The effective date above identifies the current version.</p>
    </section>
  </article>`;
}

export async function registerSiteInformationPages(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/privacy", async (request, reply) => {
    const viewer = await viewerForRequest(request.cookies[SESSION_COOKIE_NAME]);
    return reply.type("text/html; charset=utf-8").send(renderPage(assets, {
      pathname: "/privacy",
      title: "Privacy — OH CRIT I Pulled!",
      description: "Privacy information for the OH CRIT I Pulled! guild website.",
      viewer,
      stylesheets: ["site-information.css"],
      header: documentHeader("Privacy", "What Guild Operations uses, why it uses it, and where that information comes from."),
      body: privacyBody(),
    }));
  });

  app.get("/terms", async (request, reply) => {
    const viewer = await viewerForRequest(request.cookies[SESSION_COOKIE_NAME]);
    return reply.type("text/html; charset=utf-8").send(renderPage(assets, {
      pathname: "/terms",
      title: "Terms — OH CRIT I Pulled!",
      description: "Terms for using the OH CRIT I Pulled! guild website.",
      viewer,
      stylesheets: ["site-information.css"],
      header: documentHeader("Terms", "The practical ground rules for using the guild's participation site."),
      body: termsBody(),
    }));
  });
}
