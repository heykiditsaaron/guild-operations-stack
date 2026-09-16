export type UnixTimestamp = number;

export type GuildEventOccurrence =
  | readonly [UnixTimestamp]
  | readonly [UnixTimestamp, UnixTimestamp];

export type GuildEventDestination = {
  kind: string;
  label: string;
  href: string;
};

export type GuildEventPublicationInput = {
  publicationId: string;
  label: string;
  occursAt: readonly GuildEventOccurrence[];
  description?: string | null;
  category?: string | null;
  tags?: readonly string[];
  destinations?: readonly GuildEventDestination[];
};

export type GuildEventPublication = {
  publicationId: string;
  label: string;
  occursAt: GuildEventOccurrence[];
  description: string | null;
  category: string | null;
  tags: string[];
  destinations: GuildEventDestination[];
  publishedAtUnix: UnixTimestamp;
  updatedAtUnix: UnixTimestamp;
};
