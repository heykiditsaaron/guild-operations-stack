export type GuildEventOccursAt = readonly [number] | readonly [number, number];

export type GuildEventInteraction = {
  kind: string;
  label: string;
  destination: string;
};

export type GuildEventPublicationInput = {
  publicationId: string;
  title: string;
  description?: string | null;
  occursAt: GuildEventOccursAt;
  category: string;
  tags?: readonly string[];
  interactions?: readonly GuildEventInteraction[];
};

export type GuildEventPublication = {
  publicationId: string;
  title: string;
  description: string | null;
  occursAt: GuildEventOccursAt;
  category: string;
  tags: string[];
  interactions: GuildEventInteraction[];
  publishedAtUnix: number;
  updatedAtUnix: number;
};
