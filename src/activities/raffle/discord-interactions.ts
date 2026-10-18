import { approveRaffleClaim } from "./application.js";
import { establishDiscordIdentity, resolvedActorSubjectForDiscordIdentity } from "../../integrations/discord/identity.js";
import { registerDiscordComponentHandler, type DiscordComponentInteraction, type DiscordInteractionResponse } from "../../integrations/discord/interaction-handlers.js";

const ephemeral = (content: string): DiscordInteractionResponse => ({ type: 4, data: { flags: 64, content } });

async function handleRaffle(interaction: DiscordComponentInteraction): Promise<DiscordInteractionResponse> {
  const match = /^go:raffle:(enter|approve|deny|withdraw):([0-9a-f-]{36})$/.exec(interaction.data?.custom_id ?? "");
  if (!match) return ephemeral("This raffle interaction is no longer valid.");
  const [, action, id] = match;
  if (action !== "approve") return ephemeral("This raffle action is not available yet. Please use the Guild Operations website.");
  const user = interaction.member?.user;
  if (!user?.id || !/^\d+$/.test(user.id)) return ephemeral("Discord member identity unavailable.");
  const discordIdentityId = await establishDiscordIdentity({
    discordUserId: user.id,
    username: interaction.member?.nick || user.global_name || user.username,
  });
  const subject = await resolvedActorSubjectForDiscordIdentity(discordIdentityId);
  if (subject === discordIdentityId) return ephemeral("Link your Discord identity to your Guild Operations account before approving claims.");
  // Application authority enforces raffle.claims. Discord roles do not grant permission.
  await approveRaffleClaim(subject, id);
  return ephemeral("Raffle claim approved.");
}

export function registerDiscordRaffleInteractionHandler(): void {
  registerDiscordComponentHandler("go:raffle:", async (interaction) => {
    try {
      return await handleRaffle(interaction);
    } catch {
      return ephemeral("Raffle action could not be completed. Check your guild permissions or use the Guild Operations website.");
    }
  });
}
