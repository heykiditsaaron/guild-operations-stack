# Operational inspection

Operational inspection is global Guild Operations infrastructure for preserving and reviewing administrative evidence produced by the application.

Its purpose is to let an authorized administrator inspect meaningful operational results and noteworthy operational exceptions from within the web application without requiring access to container logs or the runtime environment.

This document is intentionally a focused doctrine anchor for the capability. The repository's broader infrastructure classification and documentation structure will be addressed separately. For now, this system is explicitly classified as **infrastructure**.

## Responsibility boundary

Operational inspection owns three things:

1. a small shared contract through which application code can deliberately publish inspectable operational evidence;
2. persistence of that evidence across process and container restarts;
3. an authorized administrative surface for reviewing it.

It does not own the operation that produced the evidence.

A global procedure or module remains responsible for deciding:

- what operation occurred;
- whether its result is meaningful for administrative inspection;
- whether an abnormal condition is important enough to raise as an operational exception;
- what producer-specific details are useful and safe to preserve.

Operational inspection stores and presents that declaration. It does not reinterpret or become authoritative for the producer's domain state.

## Infrastructure relationship

This is shared infrastructure because both global Guild Operations machinery and independently owned modules may need the same durable administrative inspection capability.

A producer explicitly declares its source when publishing a record. The infrastructure does not require the source to be globally owned and does not maintain a registry of permitted module types.

For example, records may eventually originate from sources such as:

- `guild`;
- `guildie`;
- `discord`;
- `raffle`.

Those examples do not establish a closed taxonomy. The source coordinate exists so administrators can identify which part of Guild Operations published the evidence.

A module publishing operational evidence does not transfer ownership of its semantics to the global infrastructure. The module still owns what its operations, outcomes, and exceptions mean.

## Operational records

The infrastructure recognizes two initial kinds of inspectable evidence.

### Result

A result records the meaningful outcome of an operation.

Initial result classifications are:

- `success`;
- `partial`;
- `failure`.

`partial` is intentional. Guild Operations procedures may successfully establish one kind of truth while non-authoritative follow-up work fails. Operational inspection must preserve that distinction rather than collapsing all mixed outcomes into success or failure.

### Exception

An exception records an abnormal operational condition that the owning producer deliberately considers useful for administration, testing, or troubleshooting.

Operational exceptions are not automatic copies of language-level exceptions and are not a replacement for runtime error logging.

A thrown application exception, failed database call, HTTP client error, stack trace, retry attempt, or framework diagnostic belongs only in runtime logging unless the owning procedure deliberately raises a corresponding operational exception because the resulting condition has administrative meaning.

No severity taxonomy is established initially. It should be introduced only if real operational use proves one is needed.

## Publication model

Operational evidence is explicitly published by the code that owns the operation.

The shared publication boundary remains small. A producer supplies:

- `source` — the producer-declared semantic owner;
- `operation` — a stable producer-owned operation coordinate;
- `kind` — `result` or `exception`;
- `result` — `success`, `partial`, or `failure` when the record is a result;
- an optional Guildie actor when a Guildie meaningfully initiated the operation;
- a concise human-readable summary;
- optional structured details useful for inspection.

The infrastructure assigns the occurrence time at publication, validates the common envelope, and persists one record.

It does not become a generic execution wrapper, event bus, notification mechanism, subscriber system, exception interceptor, module registry, or operation lifecycle framework.

The producer decides when publication is warranted.

Publication failure must not retroactively change the truth or result of the operation being inspected. Producers therefore treat inspection publication as best-effort relative to their domain operation and report inspection-write failure through runtime logging. Operational inspection does not recursively publish records about its own publication failures.

## Persisted contract

Operational records are stored in `operational_records` with the following common envelope:

```text
operational_record_id
occurred_at_unix
source
operation
kind
result
actor_guildie_id
a summary
details
```

`occurred_at_unix` is a Unix timestamp.

`source`, `operation`, and summary are required non-empty values.

`kind = result` requires a result classification. `kind = exception` does not carry a result classification; the exception itself is the record kind.

`actor_guildie_id` is optional and references the concrete global Guildie object. There is no generic subject, target, or resource identity in the shared envelope.

`details` is optional JSON owned semantically by the producer. Operational inspection does not register or enforce producer-specific details schemas.

The persisted table is append-oriented from application code. No general-purpose update or deletion API is provided.

## Source and operation ownership

`source` and `operation` are semantic coordinates, not generic identity machinery.

The infrastructure may store:

```text
source: guild
operation: refresh
```

or:

```text
source: raffle
operation: draw
```

without needing to understand either operation.

The source owns the meaning of its operation coordinate and any structured details attached to the record.

Operational inspection must not introduce a universal `subject_id`, generic target abstraction, generic resource identity, or similar machinery merely to normalize unrelated producers.

If multiple real producers later demonstrate a stable shared concept, that concept can be added when earned.

## Relationship to runtime logging

Operational inspection does not replace Fastify logging, container logs, process diagnostics, or external-service telemetry.

Runtime logging remains the appropriate place for implementation and debugging information such as:

- stack traces;
- database connectivity errors;
- HTTP request diagnostics;
- Blizzard retry and rate-limit behavior;
- OAuth implementation details;
- process startup and shutdown;
- migration output;
- unexpected internal exceptions.

Operational inspection exists because administrators should not need runtime access to understand meaningful application outcomes.

A single real-world failure may therefore produce both runtime telemetry and an operational record, but neither system should mechanically mirror the other.

## Relationship to domain history

Operational inspection is also distinct from authoritative domain history.

A guild roster observation, Guildie membership transition, raffle result, Discord association, or other domain fact remains authoritative in the persistence owned by that capability.

An operational record may say that Guild Operations attempted an operation and what outcome it observed. The record does not become the authoritative current state of the underlying guild, Guildie, raffle, Discord projection, or other domain object.

Existing domain publications must not automatically be copied into operational inspection merely because they are events.

## Persistence

Operational records are durable application data and must survive process and container restarts.

New persisted instants follow the repository-wide time rule: Unix timestamps are stored in persistence and converted for human presentation at the client boundary.

The initial system is append-oriented. Application code publishes new records; the infrastructure does not initially expose general-purpose update or deletion operations.

This does not establish audit-log guarantees. Operational inspection does not presently claim completeness, immutability, tamper resistance, regulated retention, security-event coverage, or forensic sufficiency.

For that reason, the system should not be described as an audit log unless those guarantees are deliberately designed and earned later.

## Administrative inspection

Operational evidence is reviewed at:

```text
/admin/operations
```

The surface belongs under the global `/admin` area because the inspection capability itself is global infrastructure even when individual records originate from modules.

The page uses the global shell's secondary-navigation contract and declares the breadcrumb hierarchy:

```text
Administration > Operations
```

The initial view is deliberately bounded to the 100 newest matching records and presents:

- client-local occurrence time derived from the persisted Unix timestamp;
- source;
- operation;
- record kind;
- result when applicable;
- concise summary;
- meaningful Guildie actor when present;
- optional structured details.

Filtering is initially limited to source and record kind. Search infrastructure, generalized query languages, dashboards, analytics, notification behavior, retention controls, and elaborate observability presentation remain outside the capability.

The `/admin` destination page evaluates Operations inspection and module administration independently. Access to one administrative destination does not imply access to another.

## Authorization

Viewing operational inspection is a distinct global administrative authority concern.

It must not be inferred from access to an `/admin` route, from raffle administration, or from an unrelated mutation capability such as `guild.refresh`.

The dedicated global capability is:

```text
operations.inspect
```

The current guild policy grants it to observed Blizzard guild rank indexes 0, 1, and 2 through the same explicit global capability mapping used by other globally owned permissions. The migration also provisions the capability for already observed eligible ranks.

Publishing operational evidence is not itself a Guildie-facing capability. Producers publish records while executing procedures whose own authorization and authority rules remain independently owned.

## Initial proving producers

The infrastructure is initially exercised by two existing global operations.

### Guild refresh

Guild refresh publishes:

```text
source: guild
operation: refresh
```

Manual web refresh and scheduled/CLI refresh use the same concrete operation boundary. A completed refresh publishes one `success` or `partial` result. Character presentation acquisition failures make the result partial without negating successfully reconciled Blizzard guild-roster truth.

A refresh that does not complete publishes one operational exception and still preserves the underlying runtime exception in runtime logging.

A manually initiated refresh records the initiating Guildie actor. Scheduled/CLI refresh has no Guildie actor.

### Guildie self refresh

Validated Guildie self refresh publishes:

```text
source: guildie
operation: self_refresh
```

OAuth cancellation, invalid/expired state, invalid session continuity, missing current membership, and Blizzard-principal mismatch do not publish operational records because the actual self-refresh operation has not been admitted.

After admission, account/Character-control reconciliation failure publishes an exception.

Successful account/Character-control reconciliation followed by ordinary presentation acquisition publishes `success` or `partial` depending on presentation failures.

If presentation acquisition raises an exception after account/Character-control reconciliation has already succeeded, the operation publishes an exception whose details preserve that distinction. The successful account/control truth is not reclassified or rolled back.

## Safety of preserved details

Operational details should contain only information useful for administrative understanding of the outcome.

They must not become a convenient dump of arbitrary runtime state.

Producers must not intentionally preserve secrets, OAuth credentials or authorization codes, session material, request headers, raw external-provider payloads, or other sensitive implementation data merely because the record supports structured details.

Stack traces and comparable developer diagnostics belong in runtime logging unless a future requirement establishes a specifically controlled need for them.

## Design constraint

Operational inspection should remain infrastructure, not become the application architecture.

Its test is simple:

> Can a producer deliberately publish a useful operational result or exception, and can an authorized administrator later inspect it from Guild Operations?

If the infrastructure begins deciding domain outcomes, executing producer procedures, manufacturing authority, subscribing to application behavior automatically, or requiring unrelated modules to conform to a speculative generalized lifecycle, it has crossed its intended boundary.
