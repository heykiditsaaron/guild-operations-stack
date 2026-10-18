import { createPublicKey, verify } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { discordInteractionPublicKey } from "./interaction-key.js";
import { discordIntegrationConfiguration } from "./configuration.js";
import { dispatchDiscordComponentInteraction, type DiscordComponentInteraction } from "./interaction-handlers.js";

type DiscordInteraction = DiscordComponentInteraction & {
  type?: number;
  application_id?: string;
  guild_id?: string;
  data?: { custom_id?: string };
  token?: string;
};

function validSignature(body: Buffer, timestamp: string, signature: string, publicKey: string): boolean {
  if (!/^[0-9a-f]{128}$/i.test(signature) || !/^\d{10,}$/.test(timestamp) || !/^[0-9a-f]{64}$/i.test(publicKey)) return false;
  // Reject requests outside the Discord replay window.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = createPublicKey({ key: Buffer.from("302a300506032b6570032100" + publicKey, "hex"), format: "der", type: "spki" });
  return verify(null, Buffer.concat([Buffer.from(timestamp), body]), key, Buffer.from(signature, "hex"));
}

/** Discord signs the raw HTTP body, so this endpoint must not use Fastify's JSON parser. */
export async function registerDiscordInteractionRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (scope) => {
    scope.addContentTypeParser("application/json", { parseAs: "buffer" }, (_request, body, done) => done(null, body));
    scope.post("/integrations/discord/interactions", async (request, reply) => {
      const body = request.body;
      if (!Buffer.isBuffer(body)) return reply.code(400).send({ error: "invalid_interaction_body" });
      const timestamp = request.headers["x-signature-timestamp"];
      const signature = request.headers["x-signature-ed25519"];
      if (typeof timestamp !== "string" || typeof signature !== "string") return reply.code(401).send({ error: "invalid_interaction_signature" });
      const publicKey = discordInteractionPublicKey();
      if (!publicKey || !validSignature(body, timestamp, signature, publicKey)) {
        return reply.code(401).send({ error: "invalid_interaction_signature" });
      }
      let interaction: DiscordInteraction;
      try { interaction = JSON.parse(body.toString("utf8")) as DiscordInteraction; }
      catch { return reply.code(400).send({ error: "invalid_interaction_body" }); }
      if (interaction.type === 1) return { type: 1 };
      if (interaction.type === 3 && interaction.token && interaction.application_id) {
        const interactionToken = interaction.token;
        const interactionApplicationId = interaction.application_id;
        void (async () => {
          try {
            const config = await discordIntegrationConfiguration();
            if (!config?.enabled || !config.applicationVerifiedAt || !config.discordGuildId || config.interactionPublicKey !== publicKey || interaction.application_id !== config.applicationId || interaction.guild_id !== config.discordGuildId) throw new Error("discord_interaction_binding_unavailable");
            const response = await dispatchDiscordComponentInteraction(interaction);
            const data = response.data ?? { content: "Interaction unavailable." };
            const result = await fetch(`https://discord.com/api/v10/webhooks/${encodeURIComponent(config.applicationId)}/${encodeURIComponent(interactionToken)}/messages/@original`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
            if (!result.ok) throw new Error(`discord_interaction_edit_${result.status}`);
          } catch (error) {
            request.log.error({ error }, "Deferred Discord interaction failed");
            await fetch(`https://discord.com/api/v10/webhooks/${encodeURIComponent(interactionApplicationId)}/${encodeURIComponent(interactionToken)}/messages/@original`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: "The interaction could not be completed. Please try again or use Guild Operations.", components: [] }),
            }).catch(() => {});
          }
        })();
        return { type: 5, data: { flags: 64 } };
      }
      return reply.code(400).send({ error: "invalid_interaction" });

    });
  });
}
