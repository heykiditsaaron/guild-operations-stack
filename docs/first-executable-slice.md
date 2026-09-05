# First Executable Vertical Slice

## Concrete stack

The first executable Guild Operations slice uses Node.js, TypeScript, Fastify, PostgreSQL, explicit `pg` SQL, Blizzard HTTP acquisition through built-in `fetch`, and an opaque first-party session cookie backed by a hashed session token in PostgreSQL.

No ORM, generalized identity framework, OAuth abstraction layer, message bus, or separate identity service is introduced.

## Slice outcome

The authority-bearing path is:

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
Guildie established/resolved
+ Blizzard account/control projection reconciled atomically
        ↓
Guild Operations session issued
        ↓
GET /me resolves the same guildie_id
```

Repeat authentication of the same Blizzard principal and region resolves the same `guildie_id`.

The original implementation described this continuity record as Subject. That terminology has been corrected: the persisted object is **Guildie**. Subject is contextual language, not a persisted object.

## Persistence mechanics

The root schema uses:

- `guildies`;
- `blizzard_principals`;
- `wow_accounts`;
- `characters`;
- `authentication_attempts`;
- `application_sessions`.

OAuth state and application session tokens are stored only as hashes. Blizzard access tokens remain transient and are not persisted.

The establish-or-resolve transaction serializes competing establishment for `(region, principal_id)` and relies on database uniqueness as the final duplicate protection.

Conflicting subordinate Blizzard coordinates already associated with another Guildie fail closed rather than being silently reparented.

## Domain boundary

Blizzard account authority establishes which Characters a Guildie controls. It does not establish the current WoW guild roster; Blizzard's guild roster is acquired separately and remains authoritative for current Character membership and numeric rank.

The resulting Guildie organizational participation and effective authority are derived from controlled Characters intersecting the current Character roster.
