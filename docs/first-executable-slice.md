# First Executable Vertical Slice

## Concrete stack

The first executable Guild Operations slice uses:

- Node.js 22+
- TypeScript
- Fastify
- PostgreSQL 16
- `pg` with explicit SQL
- Node's built-in `fetch` for Blizzard HTTP calls
- an opaque first-party session cookie backed by a hashed session token in PostgreSQL

This stack is intentionally small. No ORM, generalized identity framework, OAuth abstraction layer, message bus, or separate identity service is introduced.

## Why this stack

The first executable requirement is narrow but authority-bearing: complete Blizzard Authorization Code Flow, corroborate the authenticated WoW profile principal, atomically establish or resolve the canonical Guild Operations subject, reconcile Blizzard-owned subordinate records, and then issue an application session.

Fastify provides the HTTP boundary without imposing a large application framework. PostgreSQL provides the uniqueness and transaction semantics needed by the established persistence contract. Explicit SQL keeps the critical identity invariants visible during the first implementation instead of hiding them behind an ORM abstraction.

These are implementation choices, not domain doctrine. They can evolve later without changing the established subject model.

## Slice outcome

The first vertical slice is complete when a browser can:

```text
GET /auth/blizzard/start
        ↓
Battle.net authorization
        ↓
GET /auth/blizzard/callback
        ↓
state consumed
        ↓
code exchanged server-side
        ↓
userinfo + regional WoW profile acquired
        ↓
principal corroborated
        ↓
subject established/resolved + Blizzard projection reconciled atomically
        ↓
Guild Operations session issued
        ↓
GET /me resolves the same subject_id
```

Repeat authentication of the same Blizzard principal and region must return the same `subject_id`.

## Persistence mechanics

The first schema contains only the records required to execute that ceremony:

- `guild_subjects`
- `blizzard_principals`
- `wow_accounts`
- `characters`
- `authentication_attempts`
- `application_sessions`

OAuth state and application session tokens are stored only as SHA-256 hashes. Blizzard access tokens remain transient and are not persisted.

The establish-or-resolve transaction takes a PostgreSQL transaction-scoped advisory lock keyed from `(region, principal_id)` before resolving or creating the root. Database uniqueness constraints remain the final protection against duplicate authority coordinates.

Conflicting subordinate Blizzard coordinates already owned by another subject cause the transaction to fail rather than silently reparenting them.

## Deliberate omissions

This slice does not yet implement:

- Discord linking;
- guild membership or ranks;
- main-character selection;
- raffle, HiPS, or raid records;
- retained Blizzard tokens;
- refresh-token machinery;
- a dashboard UI;
- production TLS/reverse-proxy configuration.

Those remain downstream of proving the root authentication and continuity path end to end.
