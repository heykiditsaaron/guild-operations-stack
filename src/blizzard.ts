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

async function applicationAccessToken(): Promise<string> {
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

async function getJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Blizzard authority request failed (${response.status})`);
  return (await response.json()) as T;
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
