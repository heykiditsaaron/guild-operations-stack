# Blizzard Authentication Ceremony

## Purpose

Define the application-owned ceremony that turns successful Battle.net authorization into an authenticated Guild Operations session for one canonical Guildie.

Authentication establishes account authority. It does not create a generic Subject object; `subject` is contextual language only.

## Outcome

A successful ceremony produces:

```text
validated Blizzard authorization
        +
successful regional WoW profile acquisition
        +
resolved or established Guildie
        ↓
Guild Operations session -> guildie_id
```

The application session represents the Guildie operating Guild Operations. It does not represent a Blizzard token, WoW account, Character, or selected main.

## Start and callback validation

Guild Operations creates a short-lived authentication attempt with an unpredictable state value, selected region, creation/expiry state, and optional return destination.

The backend validates and consumes that attempt before accepting callback authority. Missing, unknown, expired, reused, or mismatched state fails the ceremony.

Authorization-code exchange occurs server-side with the configured Blizzard client credentials. Blizzard credentials and bearer tokens are not exposed to the browser.

## Authority acquisition and corroboration

With the user-authorized Blizzard token, the backend acquires:

```text
GET /oauth/userinfo
GET /profile/user/wow for the selected region
```

The authenticated principal and the top-level WoW Account Profile principal must corroborate one another.

Guild Operations does not establish a Guildie from `/oauth/userinfo` alone. Provider failure, malformed response, missing scope, or principal mismatch fails closed; none is semantic evidence that a Guildie is absent.

## Establish or resolve

Only after successful authority acquisition and corroboration does the ceremony cross into persistence.

The durable external coordinate is:

```text
(region, blizzard_principal_id)
```

Persistence performs an atomic operation:

```text
existing coordinate
    -> resolve existing guildie_id

absent coordinate
    -> create one Guildie
    -> bind Blizzard principal coordinate
    -> return new guildie_id
```

Concurrent ceremonies for the same coordinate must resolve the same Guildie rather than create duplicates.

## Blizzard account-control reconciliation

The successful persistence operation reconciles the current account structure and demonstrated Character control:

```text
Guildie
└── WoWAccount[]
    └── controlled Character[]
```

This is distinct from Blizzard's guild Character roster. Account authority establishes which Characters the Guildie controls; Blizzard's guild roster separately establishes which Characters are currently members of the WoW guild and their numeric ranks.

Reconciliation may discover new objects and refresh mutable presentation. Omission from a later response does not erase durable objects or historical participation.

## Session issuance

After Guildie establishment/resolution and reconciliation commit successfully, Guild Operations may create an application session keyed to:

```text
guildie_id
```

The session does not use BattleTag, Blizzard principal ID directly, WoW account ID, Character ID/name, or selected main as its canonical application coordinate.

Current participation, rank-derived authority, capabilities, and presentation are resolved from current backend truth rather than embedded permanently in the session.

## Self-refresh

A self-refresh ceremony starts from an already authenticated Guildie and requires the newly authenticated Blizzard principal to resolve back to the same `guildie_id` before account-control state is reconciled.

A different Blizzard principal cannot silently replace or rebind the Guildie established by the existing session.

## Failure semantics

Invalid state, provider authorization failure, token exchange failure, missing authority, acquisition failure, principal mismatch, persistence failure, reconciliation failure, or session issuance failure all mean authentication could not be completed.

They must not be translated into "new Guildie" or used to manufacture replacement continuity.

## Repeat authentication and logout

A later successful ceremony for the same `(region, blizzard_principal_id)` resolves the same Guildie.

Logout terminates the application session. It does not delete the Guildie, Blizzard authority relationship, WoW accounts, Characters, selected main, Discord association, or historical participation.

## Minimum ceremony invariants

1. OAuth state is backend-bound, unpredictable, validated, and consumed.
2. Authorization-code exchange and Blizzard authority acquisition occur server-side.
3. Successful Guildie establishment requires successful regional WoW profile acquisition.
4. Authenticated principal and WoW profile principal must corroborate.
5. Only a corroborated Blizzard principal coordinate may establish or resolve a Guildie.
6. Establish-or-resolve is duplicate-safe under concurrency.
7. Account/control reconciliation commits before a session is issued.
8. The application session resolves to `guildie_id`.
9. Provider or persistence failure is not interpreted as Guildie absence.
10. Reauthentication of the same coordinate resolves the same Guildie.
11. Logout changes session state, not Guildie continuity.
12. No persisted or canonical Subject object is created by authentication.
