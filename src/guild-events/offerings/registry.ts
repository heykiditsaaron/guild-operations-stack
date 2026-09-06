export type GuildEventOfferingArtwork =
  | Readonly<{
      kind: "asset";
      asset: string;
    }>
  | Readonly<{
      kind: "url";
      url: string;
    }>;

export type GuildEventOffering = Readonly<{
  offeringId: string;
  title: string;
  tagline: string;
  destination: string;
  artwork?: GuildEventOfferingArtwork;
}>;

const offerings = new Map<string, GuildEventOffering>();

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Guild Event Offering ${field} must not be empty`);
  }
  return normalized;
}

function normalizeArtwork(artwork: GuildEventOfferingArtwork | undefined): GuildEventOfferingArtwork | undefined {
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

export function registerGuildEventOffering(offering: GuildEventOffering): void {
  const registered: GuildEventOffering = {
    offeringId: requireText(offering.offeringId, "offeringId"),
    title: requireText(offering.title, "title"),
    tagline: requireText(offering.tagline, "tagline"),
    destination: requireText(offering.destination, "destination"),
    artwork: normalizeArtwork(offering.artwork),
  };

  if (offerings.has(registered.offeringId)) {
    throw new Error(`Guild Event Offering already registered: ${registered.offeringId}`);
  }

  offerings.set(registered.offeringId, registered);
}

export function guildEventOfferings(): readonly GuildEventOffering[] {
  return [...offerings.values()];
}
