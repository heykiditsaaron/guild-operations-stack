export type WowTrait =
  | "role.tank"
  | "role.healer"
  | "role.damage"
  | "armor.cloth"
  | "armor.leather"
  | "armor.mail"
  | "armor.plate"
  | "buff.arcane_intellect"
  | "buff.battle_shout"
  | "buff.blessing_of_the_bronze"
  | "buff.chaos_brand"
  | "buff.devotion_aura"
  | "buff.mark_of_the_wild"
  | "buff.mystic_touch"
  | "buff.power_word_fortitude"
  | "buff.skyfury"
  | "effect.bloodlust"
  | "effect.combat_resurrection"
  | "dispel.harm.magic"
  | "dispel.harm.curse"
  | "dispel.harm.poison"
  | "dispel.harm.disease"
  | "dispel.harm.bleed"
  | "dispel.help.magic"
  | "dispel.help.enrage"
  | "control.interrupt"
  | "control.stun"
  | "control.fear"
  | "control.incapacitate"
  | "control.root";

export type WowPosition = "melee" | "ranged";

export type WowClassTraitDefinition = {
  className: string;
  traits: readonly WowTrait[];
};

export type WowSpecTraitDefinition = {
  className: string;
  specName: string;
  position: WowPosition;
  traits: readonly WowTrait[];
};

const classTraits: readonly WowClassTraitDefinition[] = [
  { className: "Death Knight", traits: ["armor.plate", "effect.combat_resurrection", "control.interrupt", "control.stun"] },
  { className: "Demon Hunter", traits: ["armor.leather", "buff.chaos_brand", "dispel.help.magic", "control.interrupt", "control.stun", "control.incapacitate"] },
  { className: "Druid", traits: ["armor.leather", "buff.mark_of_the_wild", "effect.combat_resurrection", "dispel.harm.curse", "dispel.harm.poison", "dispel.help.enrage", "control.root"] },
  { className: "Evoker", traits: ["armor.mail", "buff.blessing_of_the_bronze", "effect.bloodlust", "dispel.harm.bleed", "dispel.help.enrage", "control.interrupt", "control.stun", "control.root"] },
  { className: "Hunter", traits: ["armor.mail", "effect.bloodlust", "dispel.help.magic", "dispel.help.enrage", "control.interrupt", "control.stun", "control.root"] },
  { className: "Mage", traits: ["armor.cloth", "buff.arcane_intellect", "effect.bloodlust", "dispel.harm.curse", "control.interrupt", "control.root", "control.incapacitate"] },
  { className: "Monk", traits: ["armor.leather", "buff.mystic_touch", "dispel.harm.poison", "dispel.harm.disease", "dispel.help.enrage", "control.interrupt", "control.stun", "control.incapacitate"] },
  { className: "Paladin", traits: ["armor.plate", "buff.devotion_aura", "effect.combat_resurrection", "dispel.harm.poison", "dispel.harm.disease", "control.interrupt", "control.stun"] },
  { className: "Priest", traits: ["armor.cloth", "buff.power_word_fortitude", "dispel.harm.magic", "dispel.harm.disease", "dispel.help.magic", "control.fear"] },
  { className: "Rogue", traits: ["armor.leather", "dispel.help.enrage", "control.interrupt", "control.stun", "control.incapacitate"] },
  { className: "Shaman", traits: ["armor.mail", "buff.skyfury", "effect.bloodlust", "dispel.harm.curse", "dispel.help.magic", "control.interrupt", "control.stun", "control.root"] },
  { className: "Warlock", traits: ["armor.cloth", "effect.combat_resurrection", "dispel.help.magic", "control.interrupt", "control.fear", "control.stun"] },
  { className: "Warrior", traits: ["armor.plate", "buff.battle_shout", "control.interrupt", "control.stun", "control.fear"] },
];

// Position is Blizzard's melee/ranged specialization classification from
// ChrSpecialization flags. It describes the specialization, not a character's
// current physical distance or encounter-specific targeting eligibility.
const specTraits: readonly WowSpecTraitDefinition[] = [
  { className: "Death Knight", specName: "Blood", position: "melee", traits: ["role.tank"] },
  { className: "Death Knight", specName: "Frost", position: "melee", traits: ["role.damage"] },
  { className: "Death Knight", specName: "Unholy", position: "melee", traits: ["role.damage"] },
  { className: "Demon Hunter", specName: "Havoc", position: "melee", traits: ["role.damage"] },
  { className: "Demon Hunter", specName: "Vengeance", position: "melee", traits: ["role.tank"] },
  { className: "Demon Hunter", specName: "Devourer", position: "ranged", traits: ["role.damage"] },
  { className: "Druid", specName: "Balance", position: "ranged", traits: ["role.damage"] },
  { className: "Druid", specName: "Feral", position: "melee", traits: ["role.damage"] },
  { className: "Druid", specName: "Guardian", position: "melee", traits: ["role.tank"] },
  { className: "Druid", specName: "Restoration", position: "ranged", traits: ["role.healer", "dispel.harm.magic"] },
  { className: "Evoker", specName: "Devastation", position: "ranged", traits: ["role.damage"] },
  { className: "Evoker", specName: "Preservation", position: "ranged", traits: ["role.healer", "dispel.harm.magic", "dispel.harm.poison"] },
  { className: "Evoker", specName: "Augmentation", position: "ranged", traits: ["role.damage"] },
  { className: "Hunter", specName: "Beast Mastery", position: "ranged", traits: ["role.damage"] },
  { className: "Hunter", specName: "Marksmanship", position: "ranged", traits: ["role.damage"] },
  { className: "Hunter", specName: "Survival", position: "melee", traits: ["role.damage"] },
  { className: "Mage", specName: "Arcane", position: "ranged", traits: ["role.damage"] },
  { className: "Mage", specName: "Fire", position: "ranged", traits: ["role.damage"] },
  { className: "Mage", specName: "Frost", position: "ranged", traits: ["role.damage"] },
  { className: "Monk", specName: "Brewmaster", position: "melee", traits: ["role.tank"] },
  { className: "Monk", specName: "Mistweaver", position: "melee", traits: ["role.healer", "dispel.harm.magic"] },
  { className: "Monk", specName: "Windwalker", position: "melee", traits: ["role.damage"] },
  { className: "Paladin", specName: "Holy", position: "melee", traits: ["role.healer", "dispel.harm.magic"] },
  { className: "Paladin", specName: "Protection", position: "melee", traits: ["role.tank"] },
  { className: "Paladin", specName: "Retribution", position: "melee", traits: ["role.damage"] },
  { className: "Priest", specName: "Discipline", position: "ranged", traits: ["role.healer"] },
  { className: "Priest", specName: "Holy", position: "ranged", traits: ["role.healer"] },
  { className: "Priest", specName: "Shadow", position: "ranged", traits: ["role.damage"] },
  { className: "Rogue", specName: "Assassination", position: "melee", traits: ["role.damage"] },
  { className: "Rogue", specName: "Outlaw", position: "melee", traits: ["role.damage"] },
  { className: "Rogue", specName: "Subtlety", position: "melee", traits: ["role.damage"] },
  { className: "Shaman", specName: "Elemental", position: "ranged", traits: ["role.damage"] },
  { className: "Shaman", specName: "Enhancement", position: "melee", traits: ["role.damage"] },
  { className: "Shaman", specName: "Restoration", position: "ranged", traits: ["role.healer", "dispel.harm.magic"] },
  { className: "Warlock", specName: "Affliction", position: "ranged", traits: ["role.damage"] },
  { className: "Warlock", specName: "Demonology", position: "ranged", traits: ["role.damage"] },
  { className: "Warlock", specName: "Destruction", position: "ranged", traits: ["role.damage"] },
  { className: "Warrior", specName: "Arms", position: "melee", traits: ["role.damage"] },
  { className: "Warrior", specName: "Fury", position: "melee", traits: ["role.damage"] },
  { className: "Warrior", specName: "Protection", position: "melee", traits: ["role.tank"] },
];

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function allWowClassTraitDefinitions(): readonly WowClassTraitDefinition[] {
  return classTraits;
}

export function allWowSpecTraitDefinitions(): readonly WowSpecTraitDefinition[] {
  return specTraits;
}

export function specsForClass(className: string): readonly string[] {
  const classKey = normalized(className);
  return specTraits
    .filter((definition) => normalized(definition.className) === classKey)
    .map((definition) => definition.specName);
}

export function traitsForClass(className: string): readonly WowTrait[] {
  const key = normalized(className);
  return classTraits.find((definition) => normalized(definition.className) === key)?.traits ?? [];
}

export function traitsForSpec(className: string, specName: string): readonly WowTrait[] {
  const classKey = normalized(className);
  const specKey = normalized(specName);
  const inherited = traitsForClass(className);
  const specialization = specTraits.find(
    (definition) => normalized(definition.className) === classKey && normalized(definition.specName) === specKey,
  )?.traits ?? [];

  return [...new Set<WowTrait>([...inherited, ...specialization])];
}

export function positionForSpec(className: string, specName: string): WowPosition | null {
  const classKey = normalized(className);
  const specKey = normalized(specName);
  return specTraits.find(
    (definition) => normalized(definition.className) === classKey && normalized(definition.specName) === specKey,
  )?.position ?? null;
}

export function specHasTrait(className: string, specName: string, trait: WowTrait): boolean {
  return traitsForSpec(className, specName).includes(trait);
}

export function allWowTraits(): readonly WowTrait[] {
  return [...new Set<WowTrait>([
    ...classTraits.flatMap((definition) => definition.traits),
    ...specTraits.flatMap((definition) => definition.traits),
  ])].sort();
}
