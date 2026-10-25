/**
 * PostgreSQL initialization variables only take effect for an empty cluster.
 * The executor must establish the volume's actual state before deployment.
 * An existing cluster is never implicitly adopted or assigned new credentials.
 */
export type BundledClusterEvidence =
  | { kind: "absent" }
  | { kind: "empty" }
  | { kind: "existing"; adoptionVerified: boolean }
  | { kind: "unknown" };

export function assertBundledClusterContinuity(evidence: BundledClusterEvidence): void {
  if (evidence.kind === "absent" || evidence.kind === "empty") return;
  if (evidence.kind === "existing" && evidence.adoptionVerified === true) return;
  if (evidence.kind === "existing") {
    throw new Error("Existing PostgreSQL cluster requires verified credential adoption before deployment");
  }
  throw new Error("PostgreSQL cluster state could not be verified; refusing deployment");
}
