/**
 * Discord projections are installation-wide. An emission from an earlier
 * installation guild must never be sent to the newly confirmed Discord server.
 */
export function belongsToActiveGuild(sourceGuildId: string | null | undefined, activeGuildId: string): boolean {
  return typeof sourceGuildId === "string" && sourceGuildId === activeGuildId;
}

/** A removed article no longer has a row; its publication must carry provenance. */
export function articleEmissionGuildId(
  code: string,
  recordedGuildId: string | null | undefined,
  publicationGuildId: string | undefined,
): string | undefined {
  return code === "article.removed" ? publicationGuildId : recordedGuildId ?? undefined;
}
