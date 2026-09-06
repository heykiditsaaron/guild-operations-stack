# Self account refresh

> **Status: currently bugged and pending repair.**
>
> The self account refresh capability is not currently functioning correctly. This document is retained as a record of the intended capability, not as authoritative guidance for the current implementation. The underlying machinery must be repaired before this contract is treated as current, and this document must be rewritten against the repaired implementation.
>
> When that repair is undertaken, reevaluate the document's domain model and ceremony rather than mechanically preserving the language below. The current document predates the established Guildie model and incorrectly treats `subject` as a canonical Guild Operations object/coordinate. In particular, verify and rewrite references to the caller's "canonical subject," a "Guild Operations subject," session-derived subject identity, principal-to-subject binding, and subject continuity in terms of the current Guildie/member model. Also verify the actual persistence boundary used by the repaired implementation before retaining or replacing the documented `establishOrResolveSubject()` call; the function name and ceremony described here must not be assumed to remain correct.

Self account refresh lets a currently authenticated guild member ask Guild Operations to reacquire Blizzard-owned account and character truth for their own canonical subject.

It is not an administrative refresh and it is not delegated authority over another subject.

## Authority

The caller must:

- have a valid Guild Operations session;
- currently resolve as a member of the configured guild;
- complete a fresh Blizzard OAuth ceremony with `wow.profile`;
- authenticate the same Blizzard principal already bound to the current Guild Operations subject.

The server derives the subject from the session. The caller never supplies a subject identifier to refresh.

A different Blizzard principal cannot migrate, replace, or create identity through this ceremony. Principal mismatch fails before persistence.

## Ceremony

`GET /me/refresh` creates a short-lived authentication attempt with purpose `self_refresh` and redirects to Blizzard authorization.

The existing Blizzard callback consumes the attempt and distinguishes it from ordinary login.

For self refresh, the callback:

1. reacquires the Blizzard authenticated principal and WoW account profile;
2. verifies the browser still carries the same Guild Operations subject session that requested the refresh;
3. verifies the subject still has current guild membership;
4. verifies the freshly authenticated Blizzard principal is already bound to that subject;
5. persists the new authoritative account/character observation through the existing subject persistence boundary;
6. redirects back to `/me` or the safe local `return_to` supplied when refresh began.

No new Guild Operations session is created by a successful self refresh.

## Continuity

The refresh reuses `establishOrResolveSubject()` only after principal ownership has been corroborated.

Previously observed characters remain historical facts. The newest successful Blizzard account observation determines which characters are currently controlled by the subject.

Changing account or character observations does not create a new Guild Operations subject, change the selected main automatically, or rewrite historical guild participation.

## Blizzard request boundary

Fresh user authorization is required because Guild Operations does not retain Blizzard user access tokens.

The authenticated `/oauth/userinfo` and `/profile/user/wow` authority calls continue through the shared Blizzard authority GET request gate and retry boundary. Self-service initiation does not bypass Blizzard request pacing or retry policy.
