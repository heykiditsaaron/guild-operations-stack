# Self account refresh

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
