import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../../../auth.js";
import type { AssetRegistry } from "../../../assets.js";
import { renderPage } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

function rulesBody(): string {
  return `
    <article class="raffle-reference-page raffle-rules">
      <section aria-labelledby="eligibility-heading">
        <h2 id="eligibility-heading">1. Eligibility</h2>
        <p>Raffles are open to eligible members of OH CRIT I Pulled! while raffle participation is open.</p>
      </section>

      <section aria-labelledby="entering-heading">
        <h2 id="entering-heading">2. Entering a Raffle</h2>
        <p>Entries are purchased at the entry price stated for the current raffle. Members may request one or more entries using an eligible guild character.</p>
        <p>Submitting a claim is a promise to deposit the corresponding amount of gold into the guild bank. Requested entries do not participate in the raffle until the deposit has been verified and the claim approved by a raffle attendant.</p>
      </section>

      <section aria-labelledby="deposits-heading">
        <h2 id="deposits-heading">3. Guild Bank Deposits</h2>
        <p>The full amount associated with a claim must be deposited into the guild bank using the character named on that claim so an attendant can verify it against the guild bank records.</p>
        <p>Claims that cannot be verified may be denied. An unresolved claim may be revoked by the member before the raffle concludes.</p>
      </section>

      <section aria-labelledby="drawing-heading">
        <h2 id="drawing-heading">4. Entries and Drawings</h2>
        <p>Each approved entry represents one equal chance in the drawing. All approved entries are placed into the same selection population, and one winning position is selected at random.</p>
        <p>Only approved entries participate in a drawing.</p>
      </section>

      <section aria-labelledby="prizes-heading">
        <h2 id="prizes-heading">5. Prizes</h2>
        <p>The prize and any applicable distribution are stated on the current raffle before entry.</p>
        <p>For a 50/50 raffle, entry proceeds form a single pot. The winner receives 50% of that pot and the remaining 50% remains with the guild.</p>
      </section>

      <section aria-labelledby="cancellation-heading">
        <h2 id="cancellation-heading">6. Raffle Cancellation</h2>
        <p>Guild officers may cancel a raffle when necessary. A cancelled raffle produces no winner. Gold associated with verified entries remains recorded so that any required refunds can be handled by the guild.</p>
      </section>

      <section aria-labelledby="responsible-heading">
        <h2 id="responsible-heading">7. Responsible Participation</h2>
        <p>Raffle participation is voluntary and does not guarantee a return. Prize value depends on the terms and participation in each raffle and may be less than the amount a member contributed.</p>
        <p>Members should participate only with gold they are comfortable spending.</p>
      </section>
    </article>`;
}

export async function registerRaffleRulesPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/events/raffle/rules", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const viewer = await viewerForRequest(sessionToken);

    const html = renderPage(assets, {
      pathname: "/events/raffle/rules",
      title: "Rules and Regulations · OH CRIT I Pulled! Guild Operations",
      description: "Rules and regulations for OH CRIT I Pulled! guild raffles.",
      viewer,
      secondaryNavigation: {
        kind: "breadcrumb",
        items: [
          { label: "Events" },
          { label: "Raffle", href: "/events/raffle" },
          { label: "Rules and Regulations" },
        ],
      },
      stylesheets: ["raffle.css"],
      header: `
        <div class="raffle-page-header">
          <p class="eyebrow">Events · Raffle</p>
          <h1 id="page-title">Rules and Regulations</h1>
          <p class="lede">The standing rules for participating in guild raffles.</p>
        </div>`,
      body: rulesBody(),
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
