import { config } from "../../config.js";
import { positionForSpec } from "../../wow-traits/registry.js";
import { activeRaidSignups, type RaidSignupView } from "../raid/participation-view.js";
import { raidEventFacts, raidSignupsAreOpen, type RaidEventFacts } from "../raid/application.js";
import type { DiscordMessageInput } from "./client.js";

export type DiscordRaidProjectionState = {
  raid: RaidEventFacts;
  signups: RaidSignupView[];
};

export async function discordRaidProjectionState(raidId: string): Promise<DiscordRaidProjectionState | null> {
  const raid = await raidEventFacts(raidId);
  if (!raid) return null;
  const signups = await activeRaidSignups(raidId);
  return { raid, signups };
}

function signupLabel(signup: RaidSignupView): string {
  const identity = signup.characterName ?? signup.anchorValue;
  const spec = signup.selectedSpec ? ` — ${signup.selectedSpec} ${signup.className}` : ` — ${signup.className}`;
  return `• ${identity}${spec}`;
}

function groupedRoster(signups: readonly RaidSignupView[]): Record<"Tank" | "Healer" | "Melee" | "Ranged" | "Unassigned", string[]> {
  const groups = { Tank: [] as string[], Healer: [] as string[], Melee: [] as string[], Ranged: [] as string[], Unassigned: [] as string[] };
  for (const signup of signups) {
    if (!signup.assignmentId || !signup.selectedRole || !signup.selectedSpec) {
      groups.Unassigned.push(signupLabel(signup));
      continue;
    }
    if (signup.selectedRole === "tank") groups.Tank.push(signupLabel(signup));
    else if (signup.selectedRole === "healer") groups.Healer.push(signupLabel(signup));
    else {
      const position = positionForSpec(signup.className, signup.selectedSpec);
      (position === "melee" ? groups.Melee : groups.Ranged).push(signupLabel(signup));
    }
  }
  return groups;
}

function occurrenceText(raid: RaidEventFacts): string {
  const start = raid.occursAt[0];
  const end = raid.occursAt.length === 2 ? raid.occursAt[1] : null;
  return end === null
    ? `<t:${start}:F> · <t:${start}:R>`
    : `<t:${start}:F> – <t:${end}:t> · <t:${start}:R>`;
}

export function renderDiscordRaidProjection(state: DiscordRaidProjectionState): DiscordMessageInput {
  const { raid, signups } = state;
  const groups = groupedRoster(signups);
  const fields = [
    { name: "When", value: occurrenceText(raid), inline: false },
    { name: "Difficulty", value: raid.difficulty[0].toUpperCase() + raid.difficulty.slice(1), inline: true },
    ...raid.requirements.map((requirement) => ({ name: requirement.label, value: requirement.value, inline: true })),
    ...Object.entries(groups).map(([name, rows]) => ({
      name: `${name} · ${rows.length}`,
      value: rows.length ? rows.join("\n").slice(0, 1024) : "—",
      inline: false,
    })),
  ].slice(0, 25);

  const viewUrl = new URL(`/events/raid/${encodeURIComponent(raid.raidId)}`, config.appOrigin).toString();
  const signupUrl = new URL(`/events/raid/${encodeURIComponent(raid.raidId)}/participation`, config.appOrigin).toString();
  const buttons: Array<{ type: 2; style: 5; label: string; url: string }> = [
    { type: 2, style: 5, label: "Open Raid", url: viewUrl },
  ];
  if (raidSignupsAreOpen(raid)) buttons.push({ type: 2, style: 5, label: "Sign Up", url: signupUrl });

  return {
    embeds: [{
      title: raid.label,
      description: raid.description ?? undefined,
      fields,
      footer: { text: "Guild Operations · Raid" },
    }],
    components: [{ type: 1, components: buttons }],
  };
}
