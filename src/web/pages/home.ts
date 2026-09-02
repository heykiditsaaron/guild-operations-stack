import type { FastifyInstance } from "fastify";
import type { AssetRegistry } from "../assets.js";
import { renderPage } from "../render.js";

export async function registerHomePage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/", async (_request, reply) => {
    const html = renderPage(assets, {
      pathname: "/",
      title: "OH CRIT I Pulled! Guild Operations",
      description: "Guild operations and community participation for OH CRIT I Pulled!",
      body: `  <main class="splash-shell">
    <section class="splash-card" aria-labelledby="page-title">
      <p class="eyebrow">Guild Operations</p>
      <h1 id="page-title">OH CRIT I Pulled!</h1>
      <p class="lede">The guild exists in Azeroth. This is where its operations continue outside the game.</p>
      <div class="status-line" aria-label="Application status">
        <span class="status-dot" aria-hidden="true"></span>
        <span>Web projection online</span>
      </div>
    </section>
  </main>`,
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
