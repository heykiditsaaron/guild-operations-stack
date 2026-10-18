import { createPublicKey, verify } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { currentDiscordApplication } from "./api.js";
import { discordIntegrationConfiguration } from "./configuration.js";

type DiscordInteraction = {
  type?: number;
  application_id?: string;
  guild_id?: string;
  data?: { custom_id?: string };
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
      const config = await discordIntegrationConfiguration();
      if (!config?.enabled || !config.applicationVerifiedAt || !config.discordGuildId) return reply.code(503).send({ error: "discord_integration_not_ready" });
      const body = request.body;
      if (!Buffer.isBuffer(body)) return reply.code(400).send({ error: "invalid_interaction_body" });
      const timestamp = request.headers["x-signature-timestamp"];
      const signature = request.headers["x-signature-ed25519"];
      if (typeof timestamp !== "string" || typeof signature !== "string") return reply.code(401).send({ error: "invalid_interaction_signature" });
      const application = await currentDiscordApplication(config.botToken);
      if (!application.verify_key || !validSignature(body, timestamp, signature, application.verify_key)) {
        return reply.code(401).send({ error: "invalid_interaction_signature" });
      }
      let interaction: DiscordInteraction;
      try { interaction = JSON.parse(body.toString("utf8")) as DiscordInteraction; }
      catch { return reply.code(400).send({ error: "invalid_interaction_body" }); }
      if (interaction.application_id !== config.applicationId) return reply.code(401).send({ error: "invalid_interaction_application" });
      if (interaction.type === 1) return { type: 1 };
      if (interaction.guild_id !== config.discordGuildId) return reply.code(403).send({ error: "invalid_interaction_guild" });
      // No mutation is permitted until the Raid-specific interaction procedure is registered.
      return { type: 4, data: { flags: 64, content: "This Guild Operations interaction is not available yet." } };
    });
  });
}
