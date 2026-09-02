import { applicationAccessToken, acquireCharacterPresentation } from "./blizzard.js";
import { config, type Region } from "./config.js";
import { pool } from "./db.js";

type RosterCharacter = {
  region: Region;
  realmId: string;
  characterId: string;
  characterName: string;
  realmSlug: string;
};

export type GuildCharacterEnrichmentResult = {
  guildId: string;
  rosterCount: number;
  attempted: number;
  succeeded: number;
  failed: number;
  apiCalls: number;
  failures: Array<{
    characterId: string;
    realmId: string;
    name: string;
    error: string;
  }>;
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

function createRequestGate(intervalMs: number): () => Promise<void> {
  let nextAt = 0;
  let chain = Promise.resolve();

  return () => {
    const scheduled = chain.then(async () => {
      const now = Date.now();
      const waitMs = Math.max(0, nextAt - now);
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      nextAt = Date.now() + intervalMs;
    });
    chain = scheduled.catch(() => undefined);
    return scheduled;
  };
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
    if (!row.realm_slug) {
      throw new Error(`Current roster character ${row.character_name} is missing realm_slug`);
    }
    return {
      region: row.region,
      realmId: row.realm_id,
      characterId: row.character_id,
      characterName: row.character_name,
      realmSlug: row.realm_slug,
    };
  });
}

async function persistCharacterPresentation(character: RosterCharacter, observedAt: Date, profile: Awaited<ReturnType<typeof acquireCharacterPresentation>>["profile"], media: Awaited<ReturnType<typeof acquireCharacterPresentation>>["media"]): Promise<void> {
  const profileCharacterId = String(profile.id);
  const profileRealmId = String(profile.realm.id);
  if (profileCharacterId !== character.characterId || profileRealmId !== character.realmId) {
    throw new Error("Blizzard character profile did not corroborate roster character coordinate");
  }

  const realmSlug = profile.realm.slug ?? character.realmSlug;
  const assets = media.assets ?? [];

  await pool.query(
    `INSERT INTO wow_character_profiles (
       region, realm_id, character_id, name, realm_name, realm_slug,
       level, faction, race_id, race_name, class_id, class_name,
       active_spec_id, active_spec_name, avatar_url, inset_url, main_url,
       profile_payload, media_payload, profile_acquired_at, media_acquired_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20,$20
     )
     ON CONFLICT (region, realm_id, character_id) DO UPDATE SET
       name = EXCLUDED.name,
       realm_name = EXCLUDED.realm_name,
       realm_slug = EXCLUDED.realm_slug,
       level = EXCLUDED.level,
       faction = EXCLUDED.faction,
       race_id = EXCLUDED.race_id,
       race_name = EXCLUDED.race_name,
       class_id = EXCLUDED.class_id,
       class_name = EXCLUDED.class_name,
       active_spec_id = EXCLUDED.active_spec_id,
       active_spec_name = EXCLUDED.active_spec_name,
       avatar_url = EXCLUDED.avatar_url,
       inset_url = EXCLUDED.inset_url,
       main_url = EXCLUDED.main_url,
       profile_payload = EXCLUDED.profile_payload,
       media_payload = EXCLUDED.media_payload,
       profile_acquired_at = EXCLUDED.profile_acquired_at,
       media_acquired_at = EXCLUDED.media_acquired_at,
       updated_at = now()`,
    [
      character.region,
      character.realmId,
      character.characterId,
      profile.name,
      localizedValue(profile.realm.name),
      realmSlug,
      profile.level ?? null,
      factionValue(profile.faction),
      profile.race?.id != null ? String(profile.race.id) : null,
      localizedValue(profile.race?.name),
      profile.character_class?.id != null ? String(profile.character_class.id) : null,
      localizedValue(profile.character_class?.name),
      profile.active_spec?.id != null ? String(profile.active_spec.id) : null,
      localizedValue(profile.active_spec?.name),
      mediaUrl(assets, "avatar"),
      mediaUrl(assets, "inset"),
      mediaUrl(assets, "main-raw") ?? mediaUrl(assets, "main"),
      JSON.stringify(profile),
      JSON.stringify(media),
      observedAt,
    ],
  );
}

export async function enrichGuildCharacters(options: {
  guildId?: string;
  concurrency?: number;
  requestsPerSecond?: number;
} = {}): Promise<GuildCharacterEnrichmentResult> {
  const guildId = options.guildId ?? config.guild.id;
  const concurrency = options.concurrency ?? 8;
  const requestsPerSecond = options.requestsPerSecond ?? 10;

  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 20) {
    throw new Error("concurrency must be an integer between 1 and 20");
  }
  if (!Number.isFinite(requestsPerSecond) || requestsPerSecond <= 0 || requestsPerSecond > 50) {
    throw new Error("requestsPerSecond must be greater than 0 and at most 50");
  }

  const roster = await currentRosterCharacters(guildId);
  const accessToken = await applicationAccessToken();
  const gate = createRequestGate(Math.ceil(1000 / requestsPerSecond));
  const failures: GuildCharacterEnrichmentResult["failures"] = [];
  let succeeded = 0;
  let apiCalls = 0;
  let cursor = 0;

  const onRequest = async () => {
    await gate();
    apiCalls += 1;
  };

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= roster.length) return;

      const character = roster[index];
      try {
        const presentation = await acquireCharacterPresentation(
          {
            region: character.region,
            realmSlug: character.realmSlug,
            characterName: character.characterName,
          },
          accessToken,
          onRequest,
        );
        await persistCharacterPresentation(character, new Date(), presentation.profile, presentation.media);
        succeeded += 1;
      } catch (error) {
        failures.push({
          characterId: character.characterId,
          realmId: character.realmId,
          name: character.characterName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, roster.length || 1) }, () => worker()));

  return {
    guildId,
    rosterCount: roster.length,
    attempted: roster.length,
    succeeded,
    failed: failures.length,
    apiCalls,
    failures,
  };
}
