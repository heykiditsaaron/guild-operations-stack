import type { CoordinationRole } from "./types.js";

export type SpecDefinition = {
  className: string;
  specName: string;
  role: CoordinationRole;
  tags: readonly string[];
};

const LUST_CLASSES = new Set(["Mage", "Shaman", "Evoker", "Hunter"]);
const BATTLE_RES_CLASSES = new Set(["Death Knight", "Druid", "Paladin", "Warlock"]);

function tagsFor(className: string, range: "melee" | "ranged", extra: readonly string[] = []): readonly string[] {
  const tags = new Set<string>([range, ...extra]);
  if (LUST_CLASSES.has(className)) tags.add("lust");
  if (BATTLE_RES_CLASSES.has(className)) tags.add("battle_res");
  if (className === "Mage") {
    tags.add("intellect_buff");
    tags.add("curse_dispel");
  }
  return [...tags];
}

function spec(
  className: string,
  specName: string,
  role: CoordinationRole,
  range: "melee" | "ranged",
  extra: readonly string[] = [],
): SpecDefinition {
  return { className, specName, role, tags: tagsFor(className, range, extra) };
}

const DEFINITIONS: readonly SpecDefinition[] = [
  spec("Death Knight", "Blood", "tank", "melee"),
  spec("Death Knight", "Frost", "damage", "melee"),
  spec("Death Knight", "Unholy", "damage", "melee"),
  spec("Demon Hunter", "Devourer", "damage", "ranged"),
  spec("Demon Hunter", "Havoc", "damage", "melee"),
  spec("Demon Hunter", "Vengeance", "tank", "melee"),
  spec("Druid", "Balance", "damage", "ranged"),
  spec("Druid", "Feral", "damage", "melee"),
  spec("Druid", "Guardian", "tank", "melee"),
  spec("Druid", "Restoration", "healer", "ranged"),
  spec("Evoker", "Augmentation", "damage", "ranged"),
  spec("Evoker", "Devastation", "damage", "ranged"),
  spec("Evoker", "Preservation", "healer", "ranged"),
  spec("Hunter", "Beast Mastery", "damage", "ranged"),
  spec("Hunter", "Marksmanship", "damage", "ranged"),
  spec("Hunter", "Survival", "damage", "melee"),
  spec("Mage", "Arcane", "damage", "ranged"),
  spec("Mage", "Fire", "damage", "ranged"),
  spec("Mage", "Frost", "damage", "ranged"),
  spec("Monk", "Brewmaster", "tank", "melee"),
  spec("Monk", "Mistweaver", "healer", "melee"),
  spec("Monk", "Windwalker", "damage", "melee"),
  spec("Paladin", "Holy", "healer", "melee"),
  spec("Paladin", "Protection", "tank", "melee"),
  spec("Paladin", "Retribution", "damage", "melee"),
  spec("Priest", "Discipline", "healer", "ranged"),
  spec("Priest", "Holy", "healer", "ranged"),
  spec("Priest", "Shadow", "damage", "ranged"),
  spec("Rogue", "Assassination", "damage", "melee"),
  spec("Rogue", "Outlaw", "damage", "melee"),
  spec("Rogue", "Subtlety", "damage", "melee"),
  spec("Shaman", "Elemental", "damage", "ranged"),
  spec("Shaman", "Enhancement", "damage", "melee"),
  spec("Shaman", "Restoration", "healer", "ranged"),
  spec("Warlock", "Affliction", "damage", "ranged"),
  spec("Warlock", "Demonology", "damage", "ranged"),
  spec("Warlock", "Destruction", "damage", "ranged"),
  spec("Warrior", "Arms", "damage", "melee"),
  spec("Warrior", "Fury", "damage", "melee"),
  spec("Warrior", "Protection", "tank", "melee"),
];

const BY_KEY = new Map(DEFINITIONS.map((definition) => [`${definition.className}:${definition.specName}`, definition]));
const CAPABILITY_TAGS = [...new Set(DEFINITIONS.flatMap((definition) => definition.tags))].sort();

export function allSpecDefinitions(): readonly SpecDefinition[] {
  return DEFINITIONS;
}

export function allCapabilityTags(): readonly string[] {
  return CAPABILITY_TAGS;
}

export function getSpecDefinition(className: string, specName: string): SpecDefinition | null {
  return BY_KEY.get(`${className}:${specName}`) ?? null;
}

export function specHasTag(className: string, specName: string, tag: string): boolean {
  return getSpecDefinition(className, specName)?.tags.includes(tag) ?? false;
}
