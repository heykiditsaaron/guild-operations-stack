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

The shared publication boundary should remain small. Conceptually, a producer supplies:

- `source` — the producer-declared semantic owner;
- `operation` — a stable producer-owned operation coordinate;
- `kind` — `result` or `exception`;
- `result` — `success`, `partial`, or `failure` when the record is a result;
- an optional Guildie actor when a Guildie meaningfully initiated the operation;
- a concise human-readable summary;
- optional structured details useful for inspection;
- the completion or occurrence time.

The infrastructure validates the common envelope and persists one record.

It must not become a generic execution wrapper, event bus, notification mechanism, subscriber system, exception interceptor, module registry, or operation lifecycle framework.

The producer decides when publication is warranted.

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

Operational evidence is intended for authorized administrative review inside Guild Operations.

The initial web surface belongs under the global `/admin` area because the inspection capability itself is global infrastructure even when individual records originate from modules.

The surface should prioritize troubleshooting and testing:

- newest records first;
- clear occurrence time;
- source;
- operation;
- record kind;
- result when applicable;
- concise summary;
- optional structured details;
- meaningful Guildie actor when present.

Filtering by source and record kind is appropriate initial inspection behavior because those are stable common coordinates and directly support troubleshooting.

The inspection UI should remain deliberately simple. Search infrastructure, generalized query languages, dashboards, analytics, notification behavior, retention controls, and elaborate observability presentation are outside the initial capability.

## Authorization

Viewing operational inspection is a distinct global administrative authority concern.

It must not be inferred from access to an `/admin` route, from raffle administration, or from an unrelated mutation capability such as `guild.refresh`.

The intended permission seam is a dedicated global capability:

```text
operations.inspect
```

Publishing operational evidence is not itself a Guildie-facing capability. Producers publish records while executing procedures whose own authorization and authority rules remain independently owned.

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
