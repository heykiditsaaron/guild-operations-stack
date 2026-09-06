export type GuildEventOffering = Readonly<{
  offeringId: string;
  title: string;
  tagline: string;
  destination: string;
}>;

const offerings = new Map<string, GuildEventOffering>();

function requireText(value: string, field: keyof GuildEventOffering): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Guild Event Offering ${field} must not be empty`);
  }
  return normalized;
}

export function registerGuildEventOffering(offering: GuildEventOffering): void {
  const registered: GuildEventOffering = {
    offeringId: requireText(offering.offeringId, "offeringId"),
    title: requireText(offering.title, "title"),
    tagline: requireText(offering.tagline, "tagline"),
    destination: requireText(offering.destination, "destination"),
  };

  if (offerings.has(registered.offeringId)) {
    throw new Error(`Guild Event Offering already registered: ${registered.offeringId}`);
  }

  offerings.set(registered.offeringId, registered);
}

export function guildEventOfferings(): readonly GuildEventOffering[] {
  return [...offerings.values()];
}
