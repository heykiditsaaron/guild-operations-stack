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

The producer owns the semantic meaning of its `source`, `operation`, result classification, summary, and structured details. Operational inspection owns only the shared publication envelope, validation, persistence, inspection, and presentation behavior.

## Publication envelope

A producer supplies:

- `source` — producer-declared semantic owner;
- `operation` — stable producer-owned operation coordinate;
- `kind` — `result` or `exception`;
- `result` — required for result records;
- optional actor identity;
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
actor_identity_id
summary
details
```

`source`, `operation`, and `summary` are required non-empty values. `kind = result` requires a result classification. `kind = exception` carries no result classification.

`actor_identity_id` is optional. There is no generic subject/target/resource identity in the shared envelope.

`details` is optional producer-owned JSON. The infrastructure does not register producer-specific detail schemas.

Application writes are append-oriented; there is no general update or deletion API.

This is not an audit-log guarantee. The capability does not claim completeness, immutability, tamper resistance, regulated retention, security-event coverage, or forensic sufficiency.

## Runtime logging boundary

Operational inspection does not replace Fastify logs, container logs, process diagnostics, or external-service telemetry.

Runtime logging remains the home for stack traces, connectivity errors, HTTP diagnostics, Blizzard retry/rate-limit detail, OAuth implementation detail, startup/shutdown, migration output, and unexpected internal exceptions.

A real-world failure may produce both runtime telemetry and an operational record, but neither mechanically mirrors the other.

## Container log operation

The packaged Compose deployment labels structured runtime records with `service: guild-operations` and `process: api` or `process: discord`; the migration container also receives `process: migrate` for consistency where it uses the shared logger. `component` identifies the subsystem. `LOG_LEVEL` can be set in the Compose environment (default `info`) for API and Discord; `debug` increases technical detail. Do not enable verbose logging indefinitely when diagnosing sensitive integrations.

For example, from the deployment directory:

```sh
GUILD_OPERATIONS_VERSION=dev docker compose logs --since=10m api discord
GUILD_OPERATIONS_VERSION=dev docker compose logs --since=10m discord | grep 'interactionId'
```

Docker logs are the runtime diagnostic sink; their retention follows the host/container logging driver configuration, not the operational-record database. Guild Settings > Logs (`/admin/history`) displays deliberately persisted administrative records, not the Docker stream. A technical Discord failure therefore does not automatically create an administrative record.

## Runtime-to-inspection lookup

After a successful operational-record insert, the inspection publisher writes a structured runtime `info` entry containing `operationalRecordId`, `source`, `operation`, `kind`, and `result`. Operators can copy the record ID from the inspection data and search container logs for the same ID. This is a durable record-to-runtime lookup, not a complete request or cross-process trace; publication IDs and other execution coordinates require separate correlation work.

The runtime entry intentionally omits the record summary, actor, and producer details to avoid duplicating sensitive administrative data in container output. If persistence fails, the caller remains responsible for best-effort handling and logging the failure; this bridge cannot emit a record ID that was never committed.

## Emission delivery diagnostics

Emission transport logs a structured `publicationId`, `consumerId`, `emissionCode`, and `attemptCount` for each claimed delivery attempt, its acknowledgment, or its failure. These coordinates allow Docker diagnostics from the API and Discord worker to be searched together, and distinguish repeated attempts for the same receipt. A staged publication is logged at `debug` level, explicitly before its enclosing transaction commits; it is not proof that the publication was committed. Unclaimed pending receipts do not generate delivery-attempt entries.

This is a transport-level trace, not an end-to-end correlation between a request, a domain operation, and an operational inspection record. Consumer receipt success means the registered consumer returned and the receipt acknowledgment was persisted; it does not guarantee exactly-once external effects.

## Discord interaction diagnostics

The shared Discord component dispatcher logs handler start and return using Discord `interactionId`, handler kind, response type, and duration, without logging interaction tokens, custom IDs, form fields, or user-provided content. Raid and Raffle handlers also log exceptions they intentionally convert into user-facing ephemeral error responses, preserving technical evidence without changing their user-visible behavior. The same interaction ID can be used to search API or Discord worker diagnostics depending on the ingress route.

A handler return is not proof of an authoritative mutation, a successful Discord webhook edit, or a durable emission acknowledgment. Those boundaries retain their own evidence and coordinates; end-to-end request-to-publication linking remains separate work.

## Domain-history boundary

Operational records are evidence about application operations, not authoritative domain history.

Roster observations, Guildie transitions, raffle results, Discord association, and other domain facts remain authoritative in the persistence owned by those capabilities.

## Administrative surface

Records are reviewed at **Guild Settings > Logs**:

```text
/admin/history
```

The former `/admin/operations` URL redirects to this page.

The page requires global capability:

```text
operations.inspect
```

Current guild policy grants it to observed Blizzard rank indexes 0, 1, and 2 through explicit global capability mapping.

The initial view is bounded to the 100 newest matching records and presents viewer-local time, source, operation, kind, result where applicable, summary, actor where present, and structured details.

Initial filtering is limited to source and record kind.

## Producer documentation

Each producer documents the operation coordinates and result semantics it publishes. Operational inspection does not maintain a registry or catalog of producers.

This keeps producer-owned meaning with the operation that establishes it while preserving one shared envelope for inspection.

## Detail safety

Producers must not place secrets, OAuth credentials/codes, session material, request headers, raw provider payloads, or arbitrary runtime dumps into operational details.

Stack traces and developer diagnostics belong in runtime logging unless a separately designed controlled need is established.

## Infrastructure boundary

Operational inspection must remain a publication-and-review facility. It must not become a generic execution wrapper, event bus, subscriber system, exception interceptor, module registry, or operation lifecycle framework.
