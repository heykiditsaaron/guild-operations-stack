# Self Account Refresh

Self account refresh lets an authenticated Guildie reacquire Blizzard-owned account/control truth for themselves and request fresh presentation for currently eligible Characters.

Eligibility semantics are doctrine defined by [`../doctrine/guild-authority.md`](../doctrine/guild-authority.md). This document describes the current user-facing refresh ceremony.

## Preconditions

The caller must:

- have a valid Guild Operations session;
- currently resolve as a member of the configured guild;
- complete fresh Blizzard OAuth with `wow.profile`;
- authenticate the same Blizzard principal already bound to the current Guildie.

The server derives `guildie_id` from the session. The caller never supplies a Guildie identifier.

A different Blizzard principal cannot replace, migrate, or establish continuity through this ceremony.

## Ceremony

`GET /me/refresh` creates a short-lived authentication attempt with purpose `self_refresh` and redirects to Blizzard authorization.

The existing Blizzard callback consumes the attempt and, for self refresh:

1. reacquires the Blizzard authenticated principal and WoW account profile;
2. verifies the same Guildie session still exists;
3. verifies current organizational participation;
4. verifies the fresh Blizzard principal is already bound to that Guildie;
5. reconciles account/control state through the existing-Guildie persistence boundary;
6. intersects newly observed controlled Characters with the persisted current guild roster;
7. requests fresh Character profile and media for those eligible Characters;
8. redirects to `/me` or the validated local `return_to`.

No new Guild Operations session is created.

The persistence step uses `reconcileExistingGuildieBlizzardObservation()` rather than the establishment-capable path documented in [`persistence-boundary.md`](persistence-boundary.md).

## Presentation refresh

Explicit self refresh requests both profile and media acquisition for every currently eligible Character rather than only stale or missing resources.

Account/control reconciliation and presentation acquisition remain separate responsibilities. Presentation failure is reported independently and does not invalidate committed account/control truth.

The shared presentation acquisition contract is documented in [`character-presentation-acquisition.md`](character-presentation-acquisition.md).

## Request boundary

Guild Operations does not retain Blizzard user access tokens, so fresh user authorization is required.

`/oauth/userinfo`, `/profile/user/wow`, and follow-up Character profile/media GETs use the shared Blizzard request gate and retry behavior.

## Continuity

A new account/control observation may change which Characters are currently controlled without creating a new Guildie, changing selected main automatically, or rewriting historical participation.

Previously observed Characters remain durable historical facts even when no longer currently controlled.
