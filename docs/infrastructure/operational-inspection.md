# Operational Inspection

Operational inspection is global infrastructure for preserving and reviewing administrator-useful evidence produced by Guild Operations without requiring container or runtime access.

It stores evidence about operations; it does not own the operations or become authoritative for their domain state.

## Producer contract

A producer deliberately publishes one of two record kinds:

- `result` — meaningful operation outcome;
- `exception` — abnormal operational condition worth administrative inspection.

Result classifications are:

- `success`;
- `partial`;
- `failure`.

`partial` preserves cases where authoritative work succeeds while non-authoritative follow-up work fails.

Operational exceptions are not automatic copies of language-level exceptions. Stack traces, framework failures, retries, database diagnostics, and similar implementation detail remain runtime logging unless the owning procedure deliberately publishes an administratively meaningful exception.

## Publication envelope

A producer supplies:

- `source` — producer-declared semantic owner;
- `operation` — stable producer-owned operation coordinate;
- `kind` — `result` or `exception`;
- `result` — required for result records;
- optional Guildie actor;
- concise human-readable summary;
- optional structured details.

The infrastructure assigns occurrence time, validates the common envelope, and persists one record.

Publication is best effort relative to the domain operation. Inspection-write failure must not change or roll back the producer's operation and should be reported through runtime logging rather than recursively through operational inspection.

## Persistence

Records are stored in `operational_records` with:

```text
operational_record_id
occurred_at_unix
source
operation
kind
result
actor_guildie_id
summary
details
```

`source`, `operation`, and `summary` are required non-empty values. `kind = result` requires a result classification. `kind = exception` carries no result classification.

`actor_guildie_id` is optional. There is no generic subject/target/resource identity in the shared envelope.

`details` is optional producer-owned JSON. The infrastructure does not register producer-specific detail schemas.

Application writes are append-oriented; there is no general update or deletion API.

This is not an audit-log guarantee. The capability does not claim completeness, immutability, tamper resistance, regulated retention, security-event coverage, or forensic sufficiency.

## Runtime logging boundary

Operational inspection does not replace Fastify logs, container logs, process diagnostics, or external-service telemetry.

Runtime logging remains the home for stack traces, connectivity errors, HTTP diagnostics, Blizzard retry/rate-limit detail, OAuth implementation detail, startup/shutdown, migration output, and unexpected internal exceptions.

A real-world failure may produce both runtime telemetry and an operational record, but neither mechanically mirrors the other.

## Domain-history boundary

Operational records are evidence about application operations, not authoritative domain history.

Roster observations, Guildie transitions, raffle results, Discord association, and other domain facts remain authoritative in the persistence owned by those capabilities.

## Administrative surface

Records are reviewed at:

```text
/admin/operations
```

The page requires global capability:

```text
operations.inspect
```

Current guild policy grants it to observed Blizzard rank indexes 0, 1, and 2 through explicit global capability mapping.

The initial view is bounded to the 100 newest matching records and presents viewer-local time, source, operation, kind, result where applicable, summary, actor where present, and structured details.

Initial filtering is limited to source and record kind.

## Initial proving producers

### Guild refresh

Publishes:

```text
source: guild
operation: refresh
```

Completed refreshes publish `success` or `partial`; incomplete admitted refreshes publish an exception when possible. Manual execution records the initiating Guildie actor; scheduled/CLI execution does not.

### Guildie self refresh

Publishes:

```text
source: guildie
operation: self_refresh
```

Pre-admission OAuth/session/principal failures do not publish operational records. After admission, reconciliation failure publishes an exception. Successful reconciliation followed by presentation work publishes `success` or `partial` according to the presentation outcome.

## Detail safety

Producers must not place secrets, OAuth credentials/codes, session material, request headers, raw provider payloads, or arbitrary runtime dumps into operational details.

Stack traces and developer diagnostics belong in runtime logging unless a separately designed controlled need is established.

## Infrastructure boundary

Operational inspection must remain a publication-and-review facility. It must not become a generic execution wrapper, event bus, subscriber system, exception interceptor, module registry, or operation lifecycle framework.
