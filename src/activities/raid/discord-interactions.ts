import { raidEventFacts, raidParticipationOfferWorkspace, establishRaidSignup } from "./application.js";
import { raidSignups } from "./participation-view.js";
import { revokeRaidSignup } from "./application.js";
import { establishDiscordIdentity, resolvedActorSubjectForDiscordIdentity } from "../../integrations/discord/identity.js";
import { registerDiscordComponentHandler, type DiscordComponentInteraction, type DiscordInteractionResponse } from "../../integrations/discord/interaction-handlers.js";
import { specsForClass } from "../../wow-traits/registry.js";
import type { RaidApplicantAnchor, RaidOfferedSpecInput } from "./domain.js";

const classes = ["Death Knight", "Demon Hunter", "Druid", "Evoker", "Hunter", "Mage", "Monk", "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"];
const ephemeral = (content: string): DiscordInteractionResponse => ({ type: 4, data: { flags: 64, content } });
const menu = (content: string, customId: string, options: { label: string; value: string }[]): DiscordInteractionResponse => ({
  type: 4, data: { flags: 64, content, components: [{ type: 1, components: [{ type: 3, custom_id: customId, min_values: 1, max_values: 1, options }] }] },
});

async function actorFor(interaction: DiscordComponentInteraction): Promise<RaidApplicantAnchor> {
  const user = interaction.member?.user;
  if (!user?.id || !/^\d+$/.test(user.id)) throw new Error("Discord member identity unavailable");
  const discordId = await establishDiscordIdentity({ discordUserId: user.id, username: user.username });
  const subject = await resolvedActorSubjectForDiscordIdentity(discordId);
  return subject === discordId ? { kind: "external", value: discordId } : { kind: "native", value: subject };
}

async function handleRaid(interaction: DiscordComponentInteraction): Promise<DiscordInteractionResponse> {
  const id = interaction.data?.custom_id ?? "";
  const match = /^go:raid:(start|character|spec|withdraw):([0-9a-f-]{36})$/.exec(id);
  if (!match) return ephemeral("This raid interaction is no longer valid.");
  const [, action, raidId] = match;
  const raid = await raidEventFacts(raidId);
  if (!raid || raid.concludedAtUnix !== null) return ephemeral("This raid is no longer accepting signups.");
  const actor = await actorFor(interaction);
  if (action === "withdraw") {
    const rows = await raidSignups(raidId);
    const mine = rows.filter(row => row.actorKind === actor.kind && row.actorReference === actor.value && row.withdrawnAtUnix === null && row.deniedAtUnix === null);
    if (!mine.length) return ephemeral("You have no active signup to withdraw.");
    for (const row of mine) await revokeRaidSignup({ raidId, signupRowId: row.signupRowId, applicantAnchor: actor });
    return ephemeral("Your raid signup has been withdrawn.");
  }
  const workspace = await raidParticipationOfferWorkspace(raid, { kind: actor.kind, reference: actor.value });
  const acquisition = workspace.requests.find(item => item.request.name === "offered_specs")?.acquisition;
  if (!acquisition || acquisition.kind !== "wow_spec") return ephemeral("Raid specialization choices are unavailable.");
  if (action === "start") {
    const characters = acquisition.characters.filter(character => character.className);
    const options = characters.slice(0, 25).map((character, index) => ({ label: `${character.name} · ${character.className}`.slice(0, 100), value: `c${index}` }));
    if (acquisition.allowDeclaredClass) options.push(...classes.slice(0, Math.max(0, 25 - options.length)).map((name, index) => ({ label: `${name} (declared)`, value: `d${index}` })));
    if (!options.length) return ephemeral("No eligible characters or class declarations are available for this raid.");
    return menu("Choose a character or class for your raid signup.", `go:raid:character:${raidId}`, options);
  }
  if (action === "character") {
    const selected = interaction.data?.values?.[0] ?? "";
    const matchChoice = /^([cd])(\d{1,2})$/.exec(selected);
    if (!matchChoice) return ephemeral("Invalid selection. Start again.");
    const index = Number(matchChoice[2]);
    const characters = acquisition.characters.filter(character => character.className).slice(0, 25);
    const selectedClass = matchChoice[1] === "c" ? characters[index]?.className : (acquisition.allowDeclaredClass ? classes[index] : undefined);
    if (!selectedClass) return ephemeral("That character or class is no longer available. Start again.");
    const specs = specsForClass(selectedClass);
    return menu(`Choose a specialization for ${selectedClass}.`, `go:raid:spec:${raidId}`, specs.map(spec => ({ label: `${spec} ${selectedClass}`, value: `${selected}:${spec}` })));
  }
  if (action === "spec") {
    const selected = interaction.data?.values?.[0] ?? "";
    const matchSpec = /^([cd])(\d{1,2}):(.{1,60})$/.exec(selected);
    if (!matchSpec) return ephemeral("Invalid specialization. Start again.");
    const index = Number(matchSpec[2]);
    const characters = acquisition.characters.filter(character => character.className).slice(0, 25);
    let offer: RaidOfferedSpecInput;
    if (matchSpec[1] === "c") {
      const character = characters[index];
      if (!character?.className || !specsForClass(character.className).includes(matchSpec[3])) return ephemeral("That character specialization is no longer available.");
      offer = { character: { region: character.region, realmId: character.realmId, characterId: character.characterId }, specName: matchSpec[3] };
    } else {
      const className = acquisition.allowDeclaredClass ? classes[index] : undefined;
      if (!className || !specsForClass(className).includes(matchSpec[3])) return ephemeral("That specialization is no longer available.");
      offer = { className, specName: matchSpec[3] };
    }
    await establishRaidSignup({ raidId, applicantAnchor: actor, offeredSpecs: [offer] });
    return ephemeral("Your raid signup has been recorded. You can use Sign up again to revise it.");
  }
  return ephemeral("Unsupported raid interaction.");
}

export function registerDiscordRaidInteractionHandler(): void {
  registerDiscordComponentHandler("go:raid:", async interaction => {
    try { return await handleRaid(interaction); }
    catch (error) { return ephemeral(error instanceof Error ? error.message.slice(0, 300) : "Raid participation is unavailable."); }
  });
}
