import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BundledClusterEvidence } from "./bundled-cluster-continuity.js";

const execFileAsync = promisify(execFile);

/** Read-only host-side Docker volume inspection; never executes inside Administration web. */
export type DockerInspect = (args: readonly string[]) => Promise<{ stdout: string }>;

export async function systemDockerInspect(args: readonly string[]): Promise<{ stdout: string }> {
  if (JSON.stringify(args) !== JSON.stringify([
    "volume", "inspect", "guild-operations_guild-operations-db", "--format", "{{json .}}",
  ])) throw new Error("Unsupported Docker inspection");
  const result = await execFileAsync("/usr/bin/docker", [...args], {
    env: { PATH: "/usr/bin:/bin", HOME: "/" },
    timeout: 10000,
    maxBuffer: 1024 * 1024,
  });
  return { stdout: result.stdout };
}

function isNotFound(error: unknown): boolean {
  // Docker CLI uses exit code 1 for an absent named volume. Require its
  // specific diagnostic; any other failure must remain unknown.
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; stderr?: unknown };
  return value.code === 1 && typeof value.stderr === "string" &&
    /No such volume:/i.test(value.stderr);
}

/**
 * Identifies absence or presence only. Docker volume inspect does not reveal
 * whether a PostgreSQL data directory is empty or whether credentials match.
 * Existing volumes are therefore unverified until a separate adoption probe.
 */
export async function inspectBundledClusterVolume(
  inspect: DockerInspect = systemDockerInspect,
): Promise<BundledClusterEvidence> {
  try {
    const result = await inspect(["volume", "inspect", "guild-operations_guild-operations-db", "--format", "{{json .}}"]);
    const parsed: unknown = JSON.parse(result.stdout);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { kind: "unknown" };
    const record = parsed as Record<string, unknown>;
    if (record.Name !== "guild-operations_guild-operations-db" ||
        record.Driver !== "local" || typeof record.Mountpoint !== "string") {
      return { kind: "unknown" };
    }
    // Presence does not establish an initialized cluster or an empty volume.
    return { kind: "unknown" };
  } catch (error) {
    if (isNotFound(error)) return { kind: "absent" };
    return { kind: "unknown" };
  }
}
