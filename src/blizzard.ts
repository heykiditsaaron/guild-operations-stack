import { config, type Region } from "./config.js";

export type BlizzardUserInfo = {
  id: number | string;
  sub: string;
  battletag?: string;
};

export type BlizzardCharacter = {
  id: number | string;
  name: string;
  level?: number;
  faction?: { type?: string; name?: string } | string;
  realm: { id: number | string; name?: string | Record<string, string>; slug?: string };
};

export type BlizzardWowAccount = {
  id: number | string;
  characters?: BlizzardCharacter[];
};

export type BlizzardWowProfile = {
  id: number | string;
  wow_accounts?: BlizzardWowAccount[];
};

export type BlizzardGuildProfile = {
  id: number | string;
  name: string;
  faction?: { type?: string; name?: string } | string;
  realm: {
    id: number | string;
    name?: string | Record<string, string>;
    slug?: string;
  };
  created_timestamp?: number;
};

export type BlizzardGuildRosterMember = {
  character: BlizzardCharacter;
  rank: number;
};

export type BlizzardGuildRoster = {
  guild: {
    id: number | string;
    name?: string;
    realm?: { id?: number | string; slug?: string };
  };
  members?: BlizzardGuildRosterMember[];
};

export type BlizzardCharacterGuildReference = {
  key?: { href?: string };
  name?: string;
  id: number | string;
  realm: {
    key?: { href?: string };
    name?: string | Record<string, string>;
    id: number | string;
    slug?: string;
  };
  faction?: { type?: string; name?: string } | string;
};

export type BlizzardCharacterProfile = {
  id: number | string;
  name: string;
  level?: number;
  faction?: { type?: string; name?: string } | string;
  race?: { id?: number | string; name?: string | Record<string, string> };
  character_class?: { id?: number | string; name?: string | Record<string, string> };
  active_spec?: { id?: number | string; name?: string | Record<string, string> };
  guild?: BlizzardCharacterGuildReference;
  realm: {
    id: number | string;
    name?: string | Record<string, string>;
    slug?: string;
  };
};

export type BlizzardCharacterMedia = {
  character?: { id?: number | string; name?: string };
  assets?: Array<{ key?: string; value?: string }>;
};

export class BlizzardAuthorityRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Blizzard authority request failed (${status})`);
    this.name = "BlizzardAuthorityRequestError";
    this.status = status;
  }
}

const BLIZZARD_REQUESTS_PER_SECOND = 10;
const BLIZZARD_REQUEST_INTERVAL_MS = Math.ceil(1000 / BLIZZARD_REQUESTS_PER_SECOND);
let nextBlizzardRequestAt = 0;
let blizzardRequestChain = Promise.resolve();

function waitForBlizzardRequestBudget(): Promise<void> {
  const scheduled = blizzardRequestChain.then(async () => {
    const waitMs = Math.max(0, nextBlizzardRequestAt - Date.now());
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    nextBlizzardRequestAt = Date.now() + BLIZZARD_REQUEST_INTERVAL_MS;
  });
  blizzardRequestChain = scheduled.catch(() => undefined);
  return scheduled;
}

export function authorizationUrl(state: string): string {
  const url = new URL("https://oauth.battle.net/authorize");
  url.searchParams.set("client_id", config.blizzardClientId);
  url.searchParams.set("redirect_uri", config.blizzardRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "wow.profile");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeAuthorizationCode(code: string): Promise<string> {
  const credentials = Buffer.from(`${config.blizzardClientId}:${config.blizzardClientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.blizzardRedirectUri,
  });

  const response = await fetch("https://oauth.battle.net/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) throw new Error(`Blizzard token exchange failed (${response.status})`);
  const payload = (await response.json()) as {
    access_token?: string;
    scope?: string;
  };
  const scopes = new Set((payload.scope ?? "").split(/\s+/).filter(Boolean));
  if (!payload.access_token || !scopes.has("wow.profile")) {
    throw new Error("Blizzard token response did not grant wow.profile");
  }
  return payload.access_token;
}

export async function applicationAccessToken(): Promise<string> {
  const credentials = Buffer.from(`${config.blizzardClientId}:${config.blizzardClientSecret}`).toString("base64");
  const response = await fetch("https://oauth.battle.net/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!response.ok) throw new Error(`Blizzard application token acquisition failed (${response.status})`);
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("Blizzard application token response omitted access_token");
  return payload.access_token;
}

export async function getJsonWithRetry<T>(
  url: string,
  accessToken: string,
  options: { attempts?: number; onRequest?: () => Promise<void> | void } = {},
): Promise<T> {
  const attempts = options.attempts ?? 4;
  let lastError: BlizzardAuthorityRequestError | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await waitForBlizzardRequestBudget();
    await options.onRequest?.();

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.ok) return (await response.json()) as T;

    const requestError = new BlizzardAuthorityRequestError(response.status);
    if (response.status !== 429 && response.status < 500) throw requestError;

    const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "0");
    const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : 500 * 2 ** (attempt - 1);
    lastError = requestError;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw lastError ?? new Error("Blizzard authority request failed");
}

async function getJson<T>(url: string, accessToken: string): Promise<T> {
  return getJsonWithRetry<T>(url, accessToken);
}

export async function acquireAuthority(region: Region, accessToken: string): Promise<{
  principalId: string;
  profile: BlizzardWowProfile;
}> {
  const userInfo = await getJson<BlizzardUserInfo>("https://oauth.battle.net/userinfo", accessToken);
  const profile = await getJson<BlizzardWowProfile>(
    `https://${region}.api.blizzard.com/profile/user/wow?namespace=profile-${region}`,
    accessToken,
  );

  const userId = String(userInfo.id);
  const userSub = String(userInfo.sub);
  const profileId = String(profile.id);
  if (!userId || !userSub || !profileId || userId !== userSub || userId !== profileId) {
    throw new Error("Blizzard principal corroboration failed");
  }

  return { principalId: userId, profile };
}

export async function acquireCharacterProfile(
  target: { region: Region; realmSlug: string; characterName: string },
  accessToken: string,
): Promise<BlizzardCharacterProfile> {
  const realm = encodeURIComponent(target.realmSlug.toLowerCase());
  const character = encodeURIComponent(target.characterName.toLowerCase());
  const suffix = `namespace=profile-${target.region}&locale=en_US`;
  return getJsonWithRetry<BlizzardCharacterProfile>(
    `https://${target.region}.api.blizzard.com/profile/wow/character/${realm}/${character}?${suffix}`,
    accessToken,
  );
}

export async function acquireGuildAuthorityByReference(target: {
  region: Region;
  referenceHref: string;
}): Promise<{
  profile: BlizzardGuildProfile;
  roster: BlizzardGuildRoster;
}> {
  const reference = new URL(target.referenceHref);
  if (reference.protocol !== "https:" || reference.hostname !== `${target.region}.api.blizzard.com`) {
    throw new Error("Blizzard guild reference does not match the authenticated region");
  }
  const accessToken = await applicationAccessToken();
  reference.searchParams.set("namespace", `profile-${target.region}`);
  reference.searchParams.set("locale", "en_US");
  const profile = await getJson<BlizzardGuildProfile>(reference.toString(), accessToken);

  const rosterUrl = new URL(reference.toString());
  rosterUrl.pathname = `${rosterUrl.pathname.replace(/\/$/, "")}/roster`;
  const roster = await getJson<BlizzardGuildRoster>(rosterUrl.toString(), accessToken);
  return { profile, roster };
}

export async function acquireGuildAuthority(target: {
  region: Region;
  realmSlug: string;
  nameSlug: string;
}): Promise<{
  profile: BlizzardGuildProfile;
  roster: BlizzardGuildRoster;
}> {
  const accessToken = await applicationAccessToken();
  const base = `https://${target.region}.api.blizzard.com/data/wow/guild/${encodeURIComponent(target.realmSlug)}/${encodeURIComponent(target.nameSlug)}`;
  const suffix = `namespace=profile-${target.region}&locale=en_US`;

  const [profile, roster] = await Promise.all([
    getJson<BlizzardGuildProfile>(`${base}?${suffix}`, accessToken),
    getJson<BlizzardGuildRoster>(`${base}/roster?${suffix}`, accessToken),
  ]);

  return { profile, roster };
}

export async function acquireCharacterPresentation(
  target: { region: Region; realmSlug: string; characterName: string },
  accessToken: string,
  onRequest?: () => Promise<void> | void,
): Promise<{ profile: BlizzardCharacterProfile; media: BlizzardCharacterMedia }> {
  const realm = encodeURIComponent(target.realmSlug.toLowerCase());
  const character = encodeURIComponent(target.characterName.toLowerCase());
  const base = `https://${target.region}.api.blizzard.com/profile/wow/character/${realm}/${character}`;
  const suffix = `namespace=profile-${target.region}&locale=en_US`;

  const profile = await getJsonWithRetry<BlizzardCharacterProfile>(`${base}?${suffix}`, accessToken, { onRequest });
  const media = await getJsonWithRetry<BlizzardCharacterMedia>(`${base}/character-media?${suffix}`, accessToken, { onRequest });
  return { profile, media };
}
