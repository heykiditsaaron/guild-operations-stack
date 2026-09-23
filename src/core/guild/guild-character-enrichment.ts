import {
  applicationAccessToken,
  BlizzardAuthorityRequestError,
  getJsonWithRetry,
  type BlizzardCharacterMedia,
  type BlizzardCharacterProfile,
} from "../../blizzard.js";
import { config, type Region } from "../../config.js";
import { pool } from "../../db.js";

export type GuildCharacterCoordinate = {
  region: Region;
  realmId: string;
  characterId: string;
};

export type GuildCharacterEnrichmentTarget = GuildCharacterCoordinate & {
  needsProfile: boolean;
  needsMedia: boolean;
};

export type CharacterPresentationAcquisitionTarget = GuildCharacterCoordinate & {
  characterName: string;
  realmSlug: string;
  needsProfile: boolean;
  needsMedia: boolean;
};

export type CharacterPresentationAcquisitionResult = {
  attempted: number;
  profilesUpdated: number;
  mediaUpdated: number;
  failedProfiles: number;
  failedMedia: number;
  apiCalls: number;
  failures: Array<{
    characterId: string;
    realmId: string;
    name: string;
    stage: "profile" | "media";
    error: string;
  }>;
};

type RosterCharacter = GuildCharacterCoordinate & {
  characterName: string;
  realmSlug: string;
};

export type GuildCharacterEnrichmentResult = CharacterPresentationAcquisitionResult & {
  guildId: string;
  rosterCount: number;
};

const NOT_FOUND_RETRY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

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

function factionValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const typed = value as { type?: unknown; name?: unknown };
    if (typeof typed.type === "string") return typed.type;
    if (typeof typed.name === "string") return typed.name;
  }
  return null;
}

function mediaUrl(assets: Array<{ key?: string; value?: string }> | undefined, key: string): string | null {
  return assets?.find((asset) => asset.key === key)?.value ?? null;
}

function coordinateKey(character: GuildCharacterCoordinate): string {
  return `${character.region}:${character.realmId}:${character.characterId}`;
}

async function currentRosterCharacters(guildId: string): Promise<RosterCharacter[]> {
  const result = await pool.query<{
    region: Region;
    realm_id: string;
    character_id: string;
    character_name: string;
    realm_slug: string | null;
  }>(
    `SELECT region, realm_id, character_id, character_name, realm_slug
       FROM guild_roster_memberships
      WHERE guild_id = $1
        AND currently_present = true
      ORDER BY rank_index, character_name`,
    [guildId],
  );

  return result.rows.map((row) => {
    if (!row.realm_slug) throw new Error(`Current roster character ${row.character_name} is missing realm_slug`);
    return {
      region: row.region,
      realmId: row.realm_id,
      characterId: row.character_id,
      characterName: row.character_name,
      realmSlug: row.realm_slug,
    };
  });
}

function unavailableStillCooling(status: number | null, attemptedAt: Date | null): boolean {
  return status === 404 && attemptedAt != null && Date.now() - attemptedAt.getTime() < NOT_FOUND_RETRY_COOLDOWN_MS;
}

export async function guildCharactersNeedingEnrichment(
  guildId: string,
  changedCoordinates: GuildCharacterCoordinate[] = [],
): Promise<GuildCharacterEnrichmentTarget[]> {
  const changed = new Set(changedCoordinates.map(coordinateKey));
  const result = await pool.query<{
    region: Region;
    realm_id: string;
    character_id: string;
    profile_missing: boolean;
    media_missing: boolean;
    profile_last_attempted_at: Date | null;
    profile_last_failure_status: number | null;
    media_last_attempted_at: Date | null;
    media_last_failure_status: number | null;
  }>(
    `SELECT
       grm.region,
       grm.realm_id,
       grm.character_id,
       (wcp.character_id IS NULL) AS profile_missing,
       (wcp.character_id IS NULL OR wcp.media_acquired_at IS NULL) AS media_missing,
       acq.profile_last_attempted_at,
       acq.profile_last_failure_status,
       acq.media_last_attempted_at,
       acq.media_last_failure_status
     FROM guild_roster_memberships grm
     LEFT JOIN wow_character_profiles wcp
       ON wcp.region = grm.region
      AND wcp.realm_id = grm.realm_id
      AND wcp.character_id = grm.character_id
     LEFT JOIN wow_character_presentation_acquisition acq
       ON acq.region = grm.region
      AND acq.realm_id = grm.realm_id
      AND acq.character_id = grm.character_id
     WHERE grm.guild_id = $1
       AND grm.currently_present = true`,
    [guildId],
  );

  return result.rows.flatMap((row) => {
    const coordinate = { region: row.region, realmId: row.realm_id, characterId: row.character_id };
    const presentationChanged = changed.has(coordinateKey(coordinate));
    const profileSuppressed = !presentationChanged
      && unavailableStillCooling(row.profile_last_failure_status, row.profile_last_attempted_at);
    const mediaSuppressed = !presentationChanged
      && unavailableStillCooling(row.media_last_failure_status, row.media_last_attempted_at);
    const needsProfile = presentationChanged || (row.profile_missing && !profileSuppressed);
    const profileAvailableOrRequested = !row.profile_missing || needsProfile;
    const needsMedia = profileAvailableOrRequested
      && (presentationChanged || (row.media_missing && !mediaSuppressed));
    return needsProfile || needsMedia ? [{ ...coordinate, needsProfile, needsMedia }] : [];
  });
}

function characterBaseUrl(character: CharacterPresentationAcquisitionTarget): string {
  const realm = encodeURIComponent(character.realmSlug.toLowerCase());
  const name = encodeURIComponent(character.characterName.toLowerCase());
  return `https://${character.region}.api.blizzard.com/profile/wow/character/${realm}/${name}`;
}

async function recordAcquisitionAttempt(
  character: GuildCharacterCoordinate,
  stage: "profile" | "media",
  failureStatus: number | null,
): Promise<void> {
  const attemptedColumn = stage === "profile" ? "profile_last_attempted_at" : "media_last_attempted_at";
  const failureColumn = stage === "profile" ? "profile_last_failure_status" : "media_last_failure_status";
  await pool.query(
    `INSERT INTO wow_character_presentation_acquisition (region, realm_id, character_id, ${attemptedColumn}, ${failureColumn})
     VALUES ($1,$2,$3,now(),$4)
     ON CONFLICT (region, realm_id, character_id) DO UPDATE SET
       ${attemptedColumn} = now(),
       ${failureColumn} = EXCLUDED.${failureColumn},
       updated_at = now()`,
    [character.region, character.realmId, character.characterId, failureStatus],
  );
}

async function persistProfile(
  character: CharacterPresentationAcquisitionTarget,
  profile: BlizzardCharacterProfile,
  observedAt: Date,
): Promise<void> {
  if (String(profile.id) !== character.characterId || String(profile.realm.id) !== character.realmId) {
    throw new Error("Blizzard character profile did not corroborate character coordinate");
  }

  await pool.query(
    `INSERT INTO wow_character_profiles (
       region, realm_id, character_id, name, realm_name, realm_slug,
       level, faction, race_id, race_name, class_id, class_name,
       active_spec_id, active_spec_name, profile_payload, profile_acquired_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16)
     ON CONFLICT (region, realm_id, character_id) DO UPDATE SET
       name = EXCLUDED.name, realm_name = EXCLUDED.realm_name, realm_slug = EXCLUDED.realm_slug,
       level = EXCLUDED.level, faction = EXCLUDED.faction, race_id = EXCLUDED.race_id,
       race_name = EXCLUDED.race_name, class_id = EXCLUDED.class_id, class_name = EXCLUDED.class_name,
       active_spec_id = EXCLUDED.active_spec_id, active_spec_name = EXCLUDED.active_spec_name,
       profile_payload = EXCLUDED.profile_payload, profile_acquired_at = EXCLUDED.profile_acquired_at, updated_at = now()`,
    [character.region, character.realmId, character.characterId, profile.name, localizedValue(profile.realm.name),
      profile.realm.slug ?? character.realmSlug, profile.level ?? null, factionValue(profile.faction),
      profile.race?.id != null ? String(profile.race.id) : null, localizedValue(profile.race?.name),
      profile.character_class?.id != null ? String(profile.character_class.id) : null, localizedValue(profile.character_class?.name),
      profile.active_spec?.id != null ? String(profile.active_spec.id) : null, localizedValue(profile.active_spec?.name),
      JSON.stringify(profile), observedAt],
  );
}

async function persistMedia(
  character: CharacterPresentationAcquisitionTarget,
  media: BlizzardCharacterMedia,
  observedAt: Date,
): Promise<void> {
  if (media.character?.id != null && String(media.character.id) !== character.characterId) {
    throw new Error("Blizzard character media did not corroborate character coordinate");
  }
  const assets = media.assets ?? [];
  await pool.query(
    `UPDATE wow_character_profiles SET avatar_url=$4, inset_url=$5, main_url=$6,
       media_payload=$7::jsonb, media_acquired_at=$8, updated_at=now()
     WHERE region=$1 AND realm_id=$2 AND character_id=$3`,
    [character.region, character.realmId, character.characterId, mediaUrl(assets, "avatar"), mediaUrl(assets, "inset"),
      mediaUrl(assets, "main-raw") ?? mediaUrl(assets, "main"), JSON.stringify(media), observedAt],
  );
}

function failureStatus(error: unknown): number | null {
  return error instanceof BlizzardAuthorityRequestError ? error.status : null;
}

export async function acquireCharacterPresentation(options: {
  targets: CharacterPresentationAcquisitionTarget[];
  concurrency?: number;
}): Promise<CharacterPresentationAcquisitionResult> {
  const concurrency = options.concurrency ?? 8;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 20) {
    throw new Error("concurrency must be an integer between 1 and 20");
  }

  const targets = options.targets;
  if (targets.length === 0) {
    return { attempted: 0, profilesUpdated: 0, mediaUpdated: 0,
      failedProfiles: 0, failedMedia: 0, apiCalls: 0, failures: [] };
  }

  const accessToken = await applicationAccessToken();
  const failures: CharacterPresentationAcquisitionResult["failures"] = [];
  let profilesUpdated = 0;
  let mediaUpdated = 0;
  let apiCalls = 0;
  let cursor = 0;
  const onRequest = () => { apiCalls += 1; };

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++;
      if (index >= targets.length) return;
      const character = targets[index];
      const base = characterBaseUrl(character);
      const suffix = `namespace=profile-${character.region}&locale=en_US`;

      let profileReady = !character.needsProfile;
      if (character.needsProfile) {
        try {
          const profile = await getJsonWithRetry<BlizzardCharacterProfile>(`${base}?${suffix}`, accessToken, { onRequest });
          console.warn("Blizzard character guild diagnostic", {
            character: `${character.characterName}-${character.realmSlug}`,
            guild: profile.guild ?? null,
          });
          await persistProfile(character, profile, new Date());
          await recordAcquisitionAttempt(character, "profile", null);
          profilesUpdated += 1;
          profileReady = true;
        } catch (error) {
          await recordAcquisitionAttempt(character, "profile", failureStatus(error));
          failures.push({ characterId: character.characterId, realmId: character.realmId, name: character.characterName,
            stage: "profile", error: error instanceof Error ? error.message : String(error) });
        }
      }

      if (!character.needsMedia || !profileReady) continue;
      try {
        const media = await getJsonWithRetry<BlizzardCharacterMedia>(`${base}/character-media?${suffix}`, accessToken, { onRequest });
        await persistMedia(character, media, new Date());
        await recordAcquisitionAttempt(character, "media", null);
        mediaUpdated += 1;
      } catch (error) {
        await recordAcquisitionAttempt(character, "media", failureStatus(error));
        failures.push({ characterId: character.characterId, realmId: character.realmId, name: character.characterName,
          stage: "media", error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()));
  return {
    attempted: targets.length,
    profilesUpdated,
    mediaUpdated,
    failedProfiles: failures.filter((failure) => failure.stage === "profile").length,
    failedMedia: failures.filter((failure) => failure.stage === "media").length,
    apiCalls,
    failures,
  };
}

export async function enrichGuildCharacters(options: {
  guildId?: string;
  concurrency?: number;
  targets?: GuildCharacterEnrichmentTarget[];
} = {}): Promise<GuildCharacterEnrichmentResult> {
  const guildId = options.guildId ?? config.guild.id;
  const fullRoster = await currentRosterCharacters(guildId);
  const requested = options.targets ? new Map(options.targets.map((target) => [coordinateKey(target), target])) : null;
  const acquisitionTargets: CharacterPresentationAcquisitionTarget[] = requested
    ? fullRoster.flatMap((character) => {
        const target = requested.get(coordinateKey(character));
        return target ? [{ ...character, needsProfile: target.needsProfile, needsMedia: target.needsMedia }] : [];
      })
    : fullRoster.map((character) => ({ ...character, needsProfile: true, needsMedia: true }));

  const acquisition = await acquireCharacterPresentation({
    targets: acquisitionTargets,
    concurrency: options.concurrency,
  });

  return {
    guildId,
    rosterCount: fullRoster.length,
    ...acquisition,
  };
}
