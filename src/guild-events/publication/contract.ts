export type UnixTimestamp = number;

export type GuildEventOccurrence =
  | readonly [UnixTimestamp]
  | readonly [UnixTimestamp, UnixTimestamp];

export type GuildEventInteraction = {
  kind: string;
  label: string;
  destination: string;
};

export type GuildEventPublicationInput = {
  publicationId: string;
  label: string;
  occursAt: readonly GuildEventOccurrence[];
  description?: string | null;
  category?: string | null;
  tags?: readonly string[];
  interactions?: readonly GuildEventInteraction[];
};

export type GuildEventPublication = {
  publicationId: string;
  label: string;
  occursAt: GuildEventOccurrence[];
  description: string | null;
  category: string | null;
  tags: string[];
  interactions: GuildEventInteraction[];
  publishedAtUnix: UnixTimestamp;
  updatedAtUnix: UnixTimestamp;
};
