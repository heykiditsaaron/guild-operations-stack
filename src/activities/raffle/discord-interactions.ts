import { createHash } from "node:crypto";
import { approveRaffleClaim, denyRaffleClaim, establishDeclaredRaffleClaim, establishRaffleClaimFromParticipationContext, raffleParticipationOfferWorkspace, getRaffle, raffleParticipationIsOpen, revokeExternalRaffleClaim, revokeRaffleClaim } from "./application.js";
import { raffleClaimLedger } from "./queries.js";
import { pool } from "../../db.js";
import { establishDiscordIdentity, resolvedActorSubjectForDiscordIdentity } from "../../integrations/discord/identity.js";
import { registerDiscordComponentHandler, type DiscordComponentInteraction, type DiscordInteractionResponse } from "../../integrations/discord/interaction-handlers.js";

const characterKey = (character: { region: string; realmId: string; characterId: string }): string =>
  "c" + createHash("sha256").update(JSON.stringify([character.region, character.realmId, character.characterId])).digest("hex").slice(0, 24);
const characterMenu = (raffleId: string, characters: readonly { name: string; realmName: string | null; region: string; realmId: string; characterId: string }[]): DiscordInteractionResponse => ({
  type: 4, data: { flags: 64, content: "Choose a controlled character for this raffle.",
    components: [{ type: 1, components: [{ type: 3, custom_id: `go:raffle:character:${raffleId}`,
      min_values: 1, max_values: 1,
      options: characters.slice(0, 25).map(character => ({
        label: `${character.name} - ${character.realmName ?? character.realmId}`.slice(0, 100),
        value: characterKey(character),
      })),
    }] }],
  },
});
const linkedEntryModal = (raffleId: string, characterKeyValue: string): DiscordInteractionResponse => ({
  type: 9, data: {
    custom_id: `go:raffle:linked-submit:${raffleId}:${characterKeyValue}`,
    title: "Enter raffle",
    components: [{ type: 1, components: [{ type: 4, custom_id: "tickets", style: 1,
      label: "Number of tickets", min_length: 1, max_length: 9, required: true }] }],
  },
});
const entryModal = (raffleId: string): DiscordInteractionResponse => ({
  type: 9,
  data: {
    custom_id: `go:raffle:enter-submit:${raffleId}`,
    title: "Enter raffle",
    components: [
      { type: 1, components: [{ type: 4, custom_id: "character", style: 1, label: "Charactername-Realm", min_length: 3, max_length: 120, required: true }] },
      { type: 1, components: [{ type: 4, custom_id: "tickets", style: 1, label: "Number of tickets", min_length: 1, max_length: 9, required: true }] },
    ],
  },
});
const modal = (claimId: string): DiscordInteractionResponse => ({
  type: 9,
  data: {
    custom_id: `go:raffle:deny-submit:${claimId}`,
    title: "Deny raffle claim",
    components: [{ type: 1, components: [{
      type: 4, custom_id: "reason", style: 2, label: "Reason for denial",
      min_length: 1, max_length: 500, required: true,
    }] }],
  },
});
const ephemeral = (content: string): DiscordInteractionResponse => ({ type: 4, data: { flags: 64, content } });

async function handleRaffle(interaction: DiscordComponentInteraction): Promise<DiscordInteractionResponse> {
  const match = /^go:raffle:(enter|enter-submit|character|linked-submit|approve|deny|deny-submit|withdraw):([0-9a-f-]{36})(?::(c[0-9a-f]{24}))?$/.exec(interaction.data?.custom_id ?? "");
  if (!match) return ephemeral("This raffle interaction is no longer valid.");
  const [, action, id, submittedCharacterKey] = match;

  const user = interaction.member?.user;
  if (!user?.id || !/^\d+$/.test(user.id)) return ephemeral("Discord member identity unavailable.");
  const discordIdentityId = await establishDiscordIdentity({
    discordUserId: user.id,
    username: interaction.member?.nick || user.global_name || user.username,
  });
  const subject = await resolvedActorSubjectForDiscordIdentity(discordIdentityId);
  if (["enter", "enter-submit", "character", "linked-submit"].includes(action)) {
    const raffle = await getRaffle(id);
    if (!raffle || !raffleParticipationIsOpen(raffle)) return ephemeral("This raffle is not accepting entries.");
    if (subject !== discordIdentityId) {
      const workspace = await raffleParticipationOfferWorkspace(raffle, subject);
      const acquisition = workspace.requests.find(request => request.request.name === "character")?.acquisition;
      if (!acquisition || acquisition.kind !== "guild_character") return ephemeral("Controlled characters are unavailable.");
      const characters = acquisition.characters;
      if (action === "enter") {
        if (!characters.length) return ephemeral("No controlled guild characters are available.");
        return characterMenu(id, characters);
      }
      if (action === "character") {
        const selected = interaction.data?.values?.[0] ?? "";
        if (!characters.some(character => characterKey(character) === selected)) return ephemeral("Character selection is no longer valid.");
        return linkedEntryModal(id, selected);
      }
      if (action !== "linked-submit") return ephemeral("Invalid entry form.");
      const character = characters.find(item => characterKey(item) === submittedCharacterKey);
      if (!character) return ephemeral("That character is no longer available.");
      const count = interaction.data?.components?.flatMap(row => row.components ?? [])
        .find(field => field.custom_id === "tickets")?.value?.trim() ?? "";
      if (!/^[1-9][0-9]{0,8}$/.test(count)) return ephemeral("Enter a positive whole number of tickets.");
      await establishRaffleClaimFromParticipationContext(subject, id, {
        character: { region: character.region, realmId: character.realmId, characterId: character.characterId },
        claim: Number(count),
      });
      return ephemeral("Your raffle claim has been recorded and is awaiting approval.");
    }
    if (action !== "enter" && action !== "enter-submit") return ephemeral("Invalid entry form.");
    if (action === "enter") return entryModal(id);
    const fields = interaction.data?.components?.flatMap(row => row.components ?? []) ?? [];
    const designation = fields.find(field => field.custom_id === "character")?.value?.trim() ?? "";
    const count = fields.find(field => field.custom_id === "tickets")?.value?.trim() ?? "";
    if (!/^[1-9][0-9]{0,8}$/.test(count)) return ephemeral("Enter a positive whole number of tickets.");
    await establishDeclaredRaffleClaim(discordIdentityId, id, designation, Number(count));
    return ephemeral("Your raffle claim has been recorded and is awaiting approval.");
  }
  if (action === "withdraw") {
    const result = await pool.query<{ raffle_id: string }>("SELECT raffle_id FROM raffle_claims WHERE claim_id = $1", [id]);
    const raffleId = result.rows[0]?.raffle_id;
    if (!raffleId) return ephemeral("Raffle claim not found.");
    const claim = (await raffleClaimLedger(raffleId)).find(row => row.claimId === id);
    if (!claim || claim.resolutionKind !== null) return ephemeral("This claim is no longer pending.");
    const ownsClaim = claim.actorKind === "external"
      ? claim.actorReference === discordIdentityId
      : claim.actorReference === subject && subject !== discordIdentityId;
    if (!ownsClaim) return ephemeral("You can only withdraw your own raffle claim.");
    if (claim.actorKind === "external") await revokeExternalRaffleClaim(discordIdentityId, id);
    else await revokeRaffleClaim(subject, id);
    return ephemeral("Your raffle claim has been withdrawn.");
  }
  if (subject === discordIdentityId) return ephemeral("Link your Discord identity to your Guild Operations account before managing claims.");
  if (action === "deny") return modal(id);
  if (action === "deny-submit") {
    const reason = interaction.data?.components?.flatMap(row => row.components ?? [])
      .find(field => field.custom_id === "reason")?.value?.trim();
    if (!reason || reason.length > 500) return ephemeral("Provide a denial reason of 1–500 characters.");
    await denyRaffleClaim(subject, id, reason);
    return ephemeral("Raffle claim denied.");
  }
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
