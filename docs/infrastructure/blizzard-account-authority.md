# Blizzard Account Authority

This infrastructure acquires and persists Blizzard account/control authority for a Guildie. It supports two ceremonies with different authority: ordinary login may establish or resolve Guildie continuity, while self refresh may only reconcile an already established Guildie and principal binding.

Domain meanings come from [`../doctrine/member-objects.md`](../doctrine/member-objects.md). Current Guildie organizational participation and authority semantics are defined there as well.

## Shared acquisition

Both ceremonies use Blizzard OAuth Authorization Code Flow with `wow.profile` and acquire:

```text
GET /oauth/userinfo
GET /profile/user/wow for the selected region
```

The authenticated principal and top-level WoW Account Profile principal must corroborate before persistence is allowed.

OAuth state is backend-bound, short-lived, unpredictable, validated, and consumed. Authorization-code exchange occurs server-side; Blizzard credentials and bearer tokens are not exposed to the browser.

Provider failure, malformed response, missing scope, or principal mismatch fails the ceremony. None is interpreted as evidence that a Guildie is absent.

Blizzard authority GET behavior is defined by [`blizzard-request-boundary.md`](blizzard-request-boundary.md).

## Account/control persistence

The durable coordinates used by this infrastructure are:

```text
guildie_id
region + blizzard_principal_id
region + realm_id + character_id
```

The persisted account/control slice operates over:

```text
Guildie
BlizzardPrincipalBinding
WoWAccount
Character
```

Current Character control and current guild-roster membership are separate observations. This infrastructure persists the account/control side only.

Given a selected Guildie and a fresh corroborated WoW account profile, shared reconciliation atomically:

```text
1. marks previously controlled Characters for the Guildie/region as not currently controlled
2. reconciles returned WoW accounts under that Guildie
3. reconciles returned Characters and marks them currently controlled
4. refreshes mutable account/Character observations
5. commits the complete account/control projection
```

The newest successful observation is authoritative for current control within the Guildie/region scope. Omission may end current control but does not delete durable Characters or historical facts. Positive contradictory ownership fails closed rather than silently reparenting an account or Character.

External Blizzard network work occurs outside the persistence transaction. Character profile/media acquisition also occurs outside this transaction and cannot establish Character control or guild eligibility.

## Login ceremony

Ordinary login may establish Guildie continuity.

After successful OAuth validation, authority acquisition, regional WoW profile acquisition, and principal corroboration, persistence uses behavior equivalent to:

```text
establishOrResolveGuildie(
    region,
    blizzardPrincipalId,
    wowProfileProjection
) -> guildie_id
```

Inside one transaction the boundary:

1. resolves or creates the Guildie for `(region, blizzard_principal_id)`;
2. confirms or updates the Blizzard principal binding observation;
3. performs shared account/control reconciliation;
4. commits; and
5. returns `guildie_id`.

Concurrent successful ceremonies for the same principal coordinate must resolve the same Guildie rather than create duplicates.

Only after the persistence transaction commits may Guild Operations issue an application session keyed to `guildie_id`.

The session represents the Guildie operating Guild Operations. It does not use BattleTag, Blizzard principal ID, WoW account ID, Character ID/name, or selected main as the application session coordinate. Current participation, rank-derived authority, capabilities, and presentation are resolved from backend truth rather than embedded permanently in the session.

A later successful login for the same principal coordinate resolves the same Guildie. Logout ends application session state; it does not delete Guildie continuity, Blizzard bindings, WoW accounts, Characters, selected main, Discord association, or historical participation.

## Self-refresh ceremony

Self refresh starts from an already authenticated Guildie and may not establish new continuity.

The caller must:

- have a valid Guild Operations session;
- currently resolve as a member of the configured guild;
- complete fresh Blizzard OAuth with `wow.profile`;
- authenticate the same Blizzard principal already bound to the current Guildie.

The server derives `guildie_id` from the session. The caller never supplies a Guildie identifier.

`GET /me/refresh` creates a short-lived authentication attempt with purpose `self_refresh` and redirects to Blizzard authorization. On callback, the application:

1. reacquires the Blizzard authenticated principal and WoW account profile;
2. verifies the same Guildie session still exists;
3. verifies current organizational participation;
4. verifies the freshly authenticated principal is already bound to that Guildie;
5. reconciles account/control state through the existing-Guildie persistence path;
6. resolves the newly observed currently controlled Characters;
7. requests fresh Character profile and media for all of those controlled Characters; and
8. redirects to `/me` or the validated local `return_to`.

The persistence operation is equivalent to:

```text
reconcileExistingGuildieBlizzardObservation(
    guildie_id,
    region,
    blizzardPrincipalId,
    wowProfileProjection
)
```

The exact `(guildie_id, region, blizzard_principal_id)` binding must already exist before mutation begins. This path cannot create a Guildie or establish a new Blizzard principal binding.

No new Guild Operations session is created by self refresh.

Explicit self refresh requests both profile and media acquisition for every currently controlled Character. Guild membership is a separate observation and does not constrain Identity-owned Character refresh. The shared acquisition facility is documented in [`character-presentation-acquisition.md`](character-presentation-acquisition.md).

Presentation acquisition failure is independent of committed account/control truth and does not retroactively invalidate reconciliation.

## Failure and continuity behavior

Authentication or refresh failure means the relevant ceremony could not be completed. Failure must not manufacture replacement continuity or reinterpret provider failure as Guildie absence.

A new account/control observation may change which Characters are currently controlled without creating a new Guildie, automatically changing selected main, or rewriting historical participation.

Previously observed Characters remain durable historical facts even when they are no longer currently controlled.

## Operational invariants

1. OAuth state is validated and consumed before callback authority is accepted.
2. Blizzard principal and regional WoW profile principal must corroborate.
3. Only ordinary login may establish or resolve Guildie continuity.
4. Self refresh requires the exact existing Guildie/principal binding.
5. `(region, blizzard_principal_id)` resolves to at most one Guildie.
6. A WoW account coordinate belongs to at most one Guildie.
7. `(region, realm_id, character_id)` resolves to at most one Character.
8. Shared account/control reconciliation is atomic and concurrency-safe.
9. Positive contradictory ownership fails closed.
10. Omission may end current control but does not erase durable objects or history.
11. External Blizzard HTTP calls occur outside the persistence transaction.
12. Character presentation acquisition occurs outside account/control persistence and cannot establish eligibility.
13. Login issues no application session before persistence commits.
14. Self refresh creates no new application session and cannot create new Guildie continuity.
15. New persisted instants follow the repository-wide Unix persistence doctrine.
