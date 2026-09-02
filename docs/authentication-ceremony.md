# Blizzard Authentication Ceremony

## Purpose

Define the application-owned ceremony that turns a user choosing to sign in with Battle.net into an authenticated Guild Operations session for one canonical `subject_id`.

This document defines boundaries, state transitions, and authority requirements. It does not choose a web framework, session library, database engine, or ORM.

## Outcome

A successful ceremony produces exactly this application-level result:

```text
validated Blizzard authorization
        +
successful regional WoW profile acquisition
        +
resolved or established GuildSubject
        ↓
Guild Operations session -> subject_id
```

The application session represents the Guild Operations subject. It does not represent a Battle.net access token, a WoW account/license, a character, or a selected main.

## Ceremony boundary

The ceremony begins when Guild Operations intentionally starts Blizzard authorization and ends in one of two terminal outcomes:

```text
SUCCESS -> application session bound to subject_id
FAILURE -> no application session established
```

An incomplete or failed ceremony must not partially authenticate the user.

## Start

When a user begins sign-in, Guild Operations creates a short-lived authentication attempt containing, semantically:

```text
AuthenticationAttempt
├── state
├── region
├── created_at
└── optional return destination
```

`state` must be unpredictable and unique enough to bind the callback to the attempt that initiated it. The live Blizzard probe confirmed that Blizzard currently requires the `state` parameter.

The selected WoW region belongs to the authentication attempt because WoW Account Profile acquisition is region/namespace scoped.

The application then redirects the browser to Blizzard authorization requesting at least:

```text
response_type=code
scope=wow.profile
state=<attempt state>
redirect_uri=<registered callback>
```

The Blizzard client secret must never be exposed to the browser.

## Callback validation

The callback is not itself proof that authentication succeeded.

Before exchanging a returned authorization code, Guild Operations must:

1. locate the matching pending authentication attempt;
2. compare the returned `state` with the state bound to that attempt;
3. reject missing, unknown, expired, or mismatched state;
4. reject an explicit provider error response;
5. require an authorization code before continuing.

A successful state comparison consumes the attempt for callback purposes. The same callback must not be reusable to establish multiple sessions.

## Authorization-code exchange

The backend exchanges the authorization code directly with Blizzard using the configured client credentials and the same registered redirect URI used to initiate authorization.

The returned token response must be treated as transient authority for completing this ceremony.

The live probe established that the successful token response carried:

```text
token_type: bearer
scope: wow.profile
expires_in: approximately 24 hours
```

Guild Operations must verify that the resulting authority is sufficient for `wow.profile` before attempting subject establishment.

The browser must never receive the Blizzard client secret. Guild Operations also should not expose the Blizzard bearer token to its own frontend merely to establish an application session.

Whether a future feature has a concrete reason to retain Blizzard tokens beyond the ceremony is explicitly deferred. The initial authentication contract does not require long-term token persistence.

## Authority acquisition

With the user-authorized Blizzard token, the backend acquires both sides of the identity relationship observed during reconnaissance:

```text
GET /oauth/userinfo
GET /profile/user/wow for the selected region
```

The first supplies the authenticated Blizzard principal. The second proves that this principal successfully exposes a WoW Account Profile under `wow.profile` authority in the selected region.

Guild Operations must not establish a subject from `/oauth/userinfo` alone.

## Principal corroboration

Before persistence, Guild Operations compares the principal represented by the authenticated user-info response with the principal represented by the top-level WoW Account Profile response.

The live probe established that:

```text
userinfo.id == userinfo.sub == /profile/user/wow.id
```

when compared by value.

For the application ceremony, the important check is semantic equality between the authenticated principal and the returned WoW profile principal.

A mismatch is an authority failure. It must not be interpreted as a new user, a missing user, or a reason to create another subject.

## Establish or resolve

Only after successful authority acquisition and principal corroboration may Guild Operations cross into persistence.

The backend normalizes the durable external coordinate:

```text
(region, blizzard_principal_id)
```

and performs one atomic establish-or-resolve operation:

```text
existing coordinate
    -> resolve existing subject_id

absent coordinate
    -> create one GuildSubject
    -> bind coordinate
    -> return new subject_id
```

Concurrent successful ceremonies for the same coordinate must not be able to create duplicate subjects. Persistence must enforce the uniqueness invariant rather than relying only on an application-level pre-check.

## Blizzard projection reconciliation

As part of the successful persistence operation, the backend reconciles the returned Blizzard projection beneath the resolved subject:

```text
GuildSubject
└── WoWAccount[]
    └── Character[]
```

The response may create newly observed subordinate records and refresh mutable current presentation data for existing ones.

Absence from one later response must not automatically delete historical identity or participation facts. Authentication refreshes current knowledge; it does not rewrite history.

A reconciliation failure means the authentication ceremony has not completed successfully. The application should not issue a session while persistence is left in an ambiguous partially reconciled state.

## Application session issuance

After the subject has been successfully resolved or established and its Blizzard projection reconciled, Guild Operations may establish its own application session.

The session's identity anchor is:

```text
subject_id
```

The session must not use any of these as its canonical application identity:

- BattleTag;
- Blizzard access token;
- Blizzard principal ID directly;
- WoW account/license ID;
- character ID;
- character name;
- selected main character.

Those values may be useful facts about the authenticated subject, but `subject_id` is the continuity reference used inside Guild Operations.

Session lifetime and transport mechanics are implementation decisions. Whatever mechanism is selected must preserve the distinction between the short-lived Blizzard authorization ceremony and the resulting Guild Operations session.

## Failure semantics

The ceremony fails closed when required authority cannot be obtained or validated.

Examples include:

```text
invalid / expired / mismatched state
provider authorization error
missing authorization code
code exchange failure
missing required scope
userinfo acquisition failure
WoW Account Profile acquisition failure
malformed authority-bearing response
principal mismatch
persistence failure
reconciliation failure
session issuance failure
```

These failures mean "authentication could not be completed." They do not mean "the subject does not exist."

In particular, provider outage, timeout, malformed response, or authorization failure must never be collapsed into semantic absence and must never trigger creation of a replacement subject.

## Repeat authentication

A later successful ceremony for the same `(region, blizzard_principal_id)` must resolve the same `subject_id`.

The live reconnaissance repeated the Blizzard OAuth ceremony independently and observed stable principal, WoW account/license, realm, and character identifiers across both runs. The persistence model therefore treats repeat authorization as re-resolution and refresh, not re-registration.

## Logout

Logging out terminates or invalidates the Guild Operations application session.

Logout does not:

- delete the GuildSubject;
- remove the Blizzard principal coordinate;
- delete WoW accounts or characters;
- change the selected main;
- rewrite historical guild activity.

Authentication state and identity continuity are separate concerns.

## Security-sensitive transient values

The initial implementation must treat these as secrets or security-sensitive transient values:

- Blizzard client secret;
- authorization code;
- Blizzard bearer access token;
- OAuth `state` before it is consumed;
- application session credential.

They must not be emitted through routine application logs.

BattleTag and character presentation data are not authentication credentials, but should still be handled as user data rather than diagnostic decoration.

## Minimum ceremony invariants

1. Blizzard authorization must be initiated with a backend-bound unpredictable `state` value.
2. The callback must validate and consume the matching authentication attempt before authority is accepted.
3. The authorization code is exchanged server-side using the Blizzard client credentials.
4. Successful subject establishment requires `wow.profile` authority.
5. `/oauth/userinfo` alone cannot establish a GuildSubject.
6. Successful regional `/profile/user/wow` acquisition is required.
7. The authenticated principal and WoW profile principal must corroborate one another.
8. Only a corroborated `(region, blizzard_principal_id)` may establish or resolve a subject.
9. Establish-or-resolve must be duplicate-safe under concurrency.
10. Reconciliation must complete before a Guild Operations session is issued.
11. The resulting application session resolves to `subject_id`.
12. Provider or persistence failure must not be interpreted as subject absence.
13. Reauthentication of the same coordinate resolves the same subject.
14. Logout changes session state, not identity continuity.

## Explicitly deferred

This ceremony deliberately does not yet decide:

- framework-specific OAuth middleware;
- cookie versus another session transport;
- application-session lifetime;
- database implementation of authentication attempts;
- token-at-rest storage, because the initial ceremony has no demonstrated need to retain Blizzard tokens;
- refresh-token behavior unless a live Blizzard response and concrete feature require it;
- Discord authentication or linking;
- authorization/role policy after authentication;
- selected-main workflow;
- public deployment hostname and production redirect URI.

Those choices should be introduced only when the executable slice requires them.
