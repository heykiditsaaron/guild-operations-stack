/** Activity plugins register Discord component handlers without a Core-to-plugin import. */
export type DiscordComponentInteraction = {
  id?: string;
  type?: number;
  application_id?: string;
  guild_id?: string;
  member?: { user?: { id?: string; username?: string } };
  data?: { custom_id?: string; values?: string[] };
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
  for (const [prefix, handler] of handlers) {
    if (id.startsWith(prefix)) return handler(interaction);
  }
  return { type: 4, data: { flags: 64, content: "This Guild Operations interaction is not available." } };
}
