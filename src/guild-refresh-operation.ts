import { refreshGuildAuthority, type GuildRefreshResult } from "./guild.js";
import { publishOperationalRecord } from "./operational-inspection.js";

type GuildRefreshOperationOptions = {
  actorGuildieId?: string | null;
  onInspectionFailure?: (error: unknown) => void;
};

function reportInspectionFailure(
  error: unknown,
  onInspectionFailure?: (error: unknown) => void,
): void {
  if (onInspectionFailure) {
    onInspectionFailure(error);
    return;
  }
  console.error("Operational inspection publication failed", error);
}

async function publishBestEffort(
  input: Parameters<typeof publishOperationalRecord>[0],
  onInspectionFailure?: (error: unknown) => void,
): Promise<void> {
  try {
    await publishOperationalRecord(input);
  } catch (error) {
    reportInspectionFailure(error, onInspectionFailure);
  }
}

function refreshDetails(result: GuildRefreshResult): Record<string, unknown> {
  return {
    guild_id: result.guildId,
    roster_count: result.rosterCount,
    characters_targeted: result.reconciliation.charactersTargeted,
    profiles_updated: result.reconciliation.profilesUpdated,
    media_updated: result.reconciliation.mediaUpdated,
    failed_profiles: result.reconciliation.failedProfiles,
    failed_media: result.reconciliation.failedMedia,
    api_calls: result.reconciliation.apiCalls,
    failures: result.reconciliation.failures.map((failure) => ({
      character_id: failure.characterId,
      realm_id: failure.realmId,
      name: failure.name,
      stage: failure.stage,
      error: failure.error,
    })),
  };
}

export async function performGuildRefresh(
  options: GuildRefreshOperationOptions = {},
): Promise<GuildRefreshResult> {
  try {
    const result = await refreshGuildAuthority();
    const partial = result.reconciliation.failedProfiles > 0 || result.reconciliation.failedMedia > 0;

    await publishBestEffort({
      source: "guild",
      operation: "refresh",
      kind: "result",
      result: partial ? "partial" : "success",
      actorGuildieId: options.actorGuildieId ?? null,
      summary: partial
        ? `Refreshed guild roster with ${result.rosterCount} members observed; some Character presentation acquisition failed.`
        : `Refreshed guild roster with ${result.rosterCount} members observed.`,
      details: refreshDetails(result),
    }, options.onInspectionFailure);

    return result;
  } catch (error) {
    await publishBestEffort({
      source: "guild",
      operation: "refresh",
      kind: "exception",
      actorGuildieId: options.actorGuildieId ?? null,
      summary: "Guild refresh did not complete.",
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    }, options.onInspectionFailure);
    throw error;
  }
}
