# Documentation

Guild Operations documentation is organized by **reader intent**.

The distinction is not between abstract and technical writing. It is between different jobs that durable documentation performs.

## Doctrine

[`doctrine/`](doctrine/) answers:

> How should I reason about Guild Operations?

Doctrine preserves product meaning, authority boundaries, domain distinctions, ownership rules, and design guidance that should survive replacement of the current implementation.

Doctrine constrains implementations. It should not become a catalog of current functions, routes, tables, schedulers, or operational procedures.

## Infrastructure

[`infrastructure/`](infrastructure/) answers:

> What shared machinery exists, and how do I use or operate it correctly?

Infrastructure documentation describes current reusable facilities and ceremonies: their responsibility boundaries, invocation surfaces, contracts, persistence behavior, authorization requirements, operational behavior, and integration points.

Infrastructure documentation is expected to change when the implementation changes. It may restate a doctrinal boundary briefly when that boundary is necessary to use the machinery safely, but the doctrine remains authoritative elsewhere.

## Features

[`features/`](features/) contains documentation for concrete globally owned Guild Operations capabilities that are neither general doctrine nor shared infrastructure.

Concrete modules may also own documentation outside this directory where their existing module documentation structure remains appropriate. A capability does not become infrastructure merely because it is globally available.

## Reference

[`reference/`](reference/) contains evidence and factual material used to support implementation and design decisions without becoming doctrine itself.

API endpoint reference remains under [`endpoints/`](endpoints/).

## Publication material

The existing event-publication documentation remains intentionally outside this realignment. That subsystem is under separate product consideration and should not drive the documentation architecture while its future is unresolved.

## Working rule

Use this test when adding or revising documentation:

- **Doctrine** — what must an implementation respect, and why?
- **Infrastructure** — how does the implementation we currently have work or get used?
- **Feature** — how does this concrete Guild Operations capability behave?
- **Reference** — what facts or evidence do we need to consult?

A useful maintenance rule follows from that distinction:

> Infrastructure documentation should be replaceable. Doctrine should be portable.
