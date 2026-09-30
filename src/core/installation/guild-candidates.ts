import {
  acquireCharacterProfile,
  applicationAccessToken,
  type BlizzardCharacterGuildReference,
} from "../../blizzard.js";
import type { Region } from "../../config.js";
import { controlledCharacterRecordIdsForIdentity } from "../identity/controlled-characters.js";
import { characterProjections } from "../identity/character-projection.js";

export type InstallationGuildCandidate = {
  guildId: string;
  region: Region;
  name: string;
  realmId: string;
  realmName: string | null;
  realmSlug: string;
  referenceHref: string;
  controlledCharacterIds: string[];
};

function localizedValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const localized = value as Record<string, unknown>;
    if (typeof localized.en_US === "string") return localized.en_US;
    const first = Object.values(localized).find((candidate) => typeof candidate === "string");
    return typeof first === "string" ? first : null;
  }
  return null;
}

function candidateFromReference(
  region: Region,
  characterId: string,
  guild: BlizzardCharacterGuildReference,
): InstallationGuildCandidate | null {
  const guildId = String(guild.id);
  const realmId = String(guild.realm?.id ?? "");
  const name = guild.name?.trim() ?? "";
  const realmSlug = guild.realm?.slug?.trim() ?? "";
  const referenceHref = guild.key?.href?.trim() ?? "";
  if (!guildId || !realmId || !name || !realmSlug || !referenceHref) return null;

  return {
    guildId,
    region,
    name,
    realmId,
    realmName: localizedValue(guild.realm.name),
    realmSlug,
    referenceHref,
    controlledCharacterIds: [characterId],
  };
}

export async function discoverInstallationGuildCandidates(
  identityId: string,
): Promise<InstallationGuildCandidate[]> {
  const characters = await characterProjections(await controlledCharacterRecordIdsForIdentity(identityId));
  const accessToken = await applicationAccessToken();
  const candidates = new Map<string, InstallationGuildCandidate>();

  for (const character of characters) {
    if (!character.realmSlug) continue;
    const profile = await acquireCharacterProfile({
      region: character.region,
      realmSlug: character.realmSlug,
      characterName: character.name,
    }, accessToken);

    if (String(profile.id) !== character.characterId || String(profile.realm.id) !== character.realmId) {
      throw new Error("Blizzard character profile did not corroborate controlled character coordinate");
    }
    if (!profile.guild) continue;

    const observed = candidateFromReference(character.region, character.characterId, profile.guild);
    if (!observed) continue;

    const key = `${observed.region}:${observed.guildId}`;
    const existing = candidates.get(key);
    if (!existing) {
      candidates.set(key, observed);
      continue;
    }

    if (
      existing.name !== observed.name
      || existing.realmId !== observed.realmId
      || existing.realmSlug !== observed.realmSlug
      || existing.referenceHref !== observed.referenceHref
    ) {
      throw new Error("Blizzard returned conflicting guild references for the same guild id");
    }
    existing.controlledCharacterIds.push(character.characterId);
  }

  return [...candidates.values()].sort((left, right) =>
    left.name.localeCompare(right.name) || left.realmName?.localeCompare(right.realmName ?? "") || 0
  );
}
