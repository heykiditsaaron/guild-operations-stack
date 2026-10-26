/**
 * Discord projections are installation-wide. An emission from an earlier
 * installation guild must never be sent to the newly confirmed Discord server.
 */
export function belongsToActiveGuild(sourceGuildId: string | null | undefined, activeGuildId: string): boolean {
  return typeof sourceGuildId === "string" && sourceGuildId === activeGuildId;
}
