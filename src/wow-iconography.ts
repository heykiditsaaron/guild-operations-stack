import { applicationAccessToken, getJsonWithRetry } from "./blizzard.js";
import { requireOperationalInstallationGuildBinding } from "./core/installation/guild-binding.js";
import { guildState } from "./core/guild/guild-state.js";
import type { WowTrait } from "./wow-traits/registry.js";

type BlizzardMedia = {
  assets?: Array<{ key?: string; value?: string }>;
};

export type RaidBuffTrait = Extract<
  WowTrait,
  | "buff.arcane_intellect"
  | "buff.battle_shout"
  | "buff.blessing_of_the_bronze"
  | "buff.chaos_brand"
  | "buff.devotion_aura"
  | "buff.mark_of_the_wild"
  | "buff.mystic_touch"
  | "buff.power_word_fortitude"
  | "buff.skyfury"
>;

const SPECIALIZATION_IDS: Readonly<Record<string, number>> = {
  "death knight:blood": 250,
  "death knight:frost": 251,
  "death knight:unholy": 252,
  "demon hunter:havoc": 577,
  "demon hunter:vengeance": 581,
  "demon hunter:devourer": 1480,
  "druid:balance": 102,
  "druid:feral": 103,
  "druid:guardian": 104,
  "druid:restoration": 105,
  "evoker:devastation": 1467,
  "evoker:preservation": 1468,
  "evoker:augmentation": 1473,
  "hunter:beast mastery": 253,
  "hunter:marksmanship": 254,
  "hunter:survival": 255,
  "mage:arcane": 62,
  "mage:fire": 63,
  "mage:frost": 64,
  "monk:brewmaster": 268,
  "monk:mistweaver": 270,
  "monk:windwalker": 269,
  "paladin:holy": 65,
  "paladin:protection": 66,
  "paladin:retribution": 70,
  "priest:discipline": 256,
  "priest:holy": 257,
  "priest:shadow": 258,
  "rogue:assassination": 259,
  "rogue:outlaw": 260,
  "rogue:subtlety": 261,
  "shaman:elemental": 262,
  "shaman:enhancement": 263,
  "shaman:restoration": 264,
  "warlock:affliction": 265,
  "warlock:demonology": 266,
  "warlock:destruction": 267,
  "warrior:arms": 71,
  "warrior:fury": 72,
  "warrior:protection": 73,
};

const RAID_BUFF_SPELLS: Readonly<Record<RaidBuffTrait, { spellId: number; label: string }>> = {
  "buff.arcane_intellect": { spellId: 1459, label: "Arcane Intellect" },
  "buff.battle_shout": { spellId: 6673, label: "Battle Shout" },
  "buff.blessing_of_the_bronze": { spellId: 364342, label: "Blessing of the Bronze" },
  "buff.chaos_brand": { spellId: 255260, label: "Chaos Brand" },
  "buff.devotion_aura": { spellId: 465, label: "Devotion Aura" },
  "buff.mark_of_the_wild": { spellId: 1126, label: "Mark of the Wild" },
  "buff.mystic_touch": { spellId: 8647, label: "Mystic Touch" },
  "buff.power_word_fortitude": { spellId: 21562, label: "Power Word: Fortitude" },
  "buff.skyfury": { spellId: 462854, label: "Skyfury" },
};

const iconCache = new Map<string, string | null>();
let accessTokenCache: { value: string; refreshAt: number } | null = null;

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function specializationKey(className: string, specName: string): string {
  return `${normalized(className)}:${normalized(specName)}`;
}

function mediaAssetUrl(media: BlizzardMedia): string | null {
  return media.assets?.find((asset) => asset.key === "icon")?.value
    ?? media.assets?.find((asset) => typeof asset.value === "string")?.value
    ?? null;
}

async function iconAccessToken(): Promise<string> {
  if (accessTokenCache && accessTokenCache.refreshAt > Date.now()) return accessTokenCache.value;
  const value = await applicationAccessToken();
  accessTokenCache = { value, refreshAt: Date.now() + 30 * 60 * 1000 };
  return value;
}

async function mediaIcon(kind: "playable-specialization" | "spell", id: number): Promise<string | null> {
  const cacheKey = `${kind}:${id}`;
  if (iconCache.has(cacheKey)) return iconCache.get(cacheKey) ?? null;

  const accessToken = await iconAccessToken();
  const binding = await requireOperationalInstallationGuildBinding();
  const guild = await guildState(binding.guildId);
  if (!guild) throw new Error("Authorized installation guild was not found");
  const region = guild.region;
  try {
    const media = await getJsonWithRetry<BlizzardMedia>(
      `https://${region}.api.blizzard.com/data/wow/media/${kind}/${id}?namespace=static-${region}&locale=en_US`,
      accessToken,
    );
    const value = mediaAssetUrl(media);
    iconCache.set(cacheKey, value);
    return value;
  } catch {
    iconCache.set(cacheKey, null);
    return null;
  }
}

export function isRaidBuffTrait(value: WowTrait): value is RaidBuffTrait {
  return Object.hasOwn(RAID_BUFF_SPELLS, value);
}

export function raidBuffLabel(trait: RaidBuffTrait): string {
  return RAID_BUFF_SPELLS[trait].label;
}

export async function raidBuffIconUrl(trait: RaidBuffTrait): Promise<string | null> {
  return mediaIcon("spell", RAID_BUFF_SPELLS[trait].spellId);
}

export async function specializationIconUrl(className: string, specName: string): Promise<string | null> {
  const id = SPECIALIZATION_IDS[specializationKey(className, specName)];
  return id == null ? null : mediaIcon("playable-specialization", id);
}
