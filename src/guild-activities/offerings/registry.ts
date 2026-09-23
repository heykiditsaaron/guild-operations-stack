export type GuildActivityOfferingArtwork =
  | Readonly<{
      kind: "asset";
      asset: string;
    }>
  | Readonly<{
      kind: "url";
      url: string;
    }>;

export type GuildActivityOffering = Readonly<{
  offeringId: string;
  title: string;
  tagline: string;
  destination: string;
  artwork?: GuildActivityOfferingArtwork;
}>;

const offerings = new Map<string, GuildActivityOffering>();

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Guild Activity Offering ${field} must not be empty`);
  }
  return normalized;
}

function normalizeArtwork(artwork: GuildActivityOfferingArtwork | undefined): GuildActivityOfferingArtwork | undefined {
  if (!artwork) return undefined;

  if (artwork.kind === "asset") {
    return {
      kind: "asset",
      asset: requireText(artwork.asset, "artwork asset"),
    };
  }

  return {
    kind: "url",
    url: requireText(artwork.url, "artwork URL"),
  };
}

export function registerGuildActivityOffering(offering: GuildActivityOffering): void {
  const registered: GuildActivityOffering = {
    offeringId: requireText(offering.offeringId, "offeringId"),
    title: requireText(offering.title, "title"),
    tagline: requireText(offering.tagline, "tagline"),
    destination: requireText(offering.destination, "destination"),
    artwork: normalizeArtwork(offering.artwork),
  };

  if (offerings.has(registered.offeringId)) {
    throw new Error(`Guild Activity Offering already registered: ${registered.offeringId}`);
  }

  offerings.set(registered.offeringId, registered);
}

export function guildActivityOfferings(): readonly GuildActivityOffering[] {
  return [...offerings.values()];
}
