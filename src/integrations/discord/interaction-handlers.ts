import { componentLogger } from "../../core/runtime-logger.js";

const log = componentLogger("discord.interactions");

/** Activity plugins register Discord component handlers without a Core-to-plugin import. */
export type DiscordComponentInteraction = {
  id?: string;
  type?: number;
  application_id?: string;
  guild_id?: string;
  member?: { nick?: string | null; user?: { id?: string; username?: string; global_name?: string | null } };
  data?: { custom_id?: string; values?: string[]; components?: Array<{ components?: Array<{ custom_id?: string; value?: string }> }> };
};

export type DiscordInteractionResponse = {
  type: number;
  data?: Record<string, unknown>;
};

type Handler = (interaction: DiscordComponentInteraction) => Promise<DiscordInteractionResponse>;
const handlers = new Map<string, Handler>();

export function registerDiscordComponentHandler(prefix: string, handler: Handler): void {
  if (handlers.has(prefix)) throw new Error(`Discord component handler already registered: ${prefix}`);
  handlers.set(prefix, handler);
}

export async function dispatchDiscordComponentInteraction(interaction: DiscordComponentInteraction): Promise<DiscordInteractionResponse> {
  const id = interaction.data?.custom_id ?? "";
  const interactionId = interaction.id ?? null;
  const startedAt = Date.now();
  for (const [prefix, handler] of handlers) {
    if (!id.startsWith(prefix)) continue;
    const context = { interactionId, interactionKind: prefix.slice(0, -1) };
    log.info(context, "Discord interaction dispatch started");
    try {
      const response = await handler(interaction);
      log.info({ ...context, responseType: response.type, durationMs: Date.now() - startedAt }, "Discord interaction handler returned");
      return response;
    } catch (error) {
      log.error({ err: error, ...context, durationMs: Date.now() - startedAt }, "Discord interaction handler threw");
      throw error;
    }
  }
  log.warn({ interactionId }, "Discord interaction handler unavailable");
  return { type: 4, data: { flags: 64, content: "This Guild Operations interaction is not available." } };
}
