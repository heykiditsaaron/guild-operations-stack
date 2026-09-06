# Self account refresh

> **Status: implementation repair pending.**
>
> The current implementation reacquires Blizzard account/control observations but does not yet complete the Character presentation refresh described below. This document records the accepted responsibility boundary for that repair; it must be reconciled with the finished implementation before the warning is removed.

Self account refresh lets a currently authenticated Guildie ask Guild Operations to reacquire Blizzard-owned account and Character-control truth for that Guildie and then refresh presentation only for Characters that are eligible for Guild Operations.

It is not an administrative guild refresh and it is not delegated authority over another Guildie.

## Responsibility boundary

Three Blizzard-owned observations remain distinct:

1. **Guildie account/control observation** answers which Characters the Guildie currently controls.
2. **Guild roster observation** answers which Characters are currently members of OH CRIT I Pulled! and what numeric guild rank each holds.
3. **Character presentation observation** supplies richer profile and media state for an already identified Character.

Self account refresh owns the first observation and may request follow-up acquisition of the third. It does not reacquire or replace the second.

Character presentation acquisition never grants Guild Operations eligibility.

## Eligible Guild Operations Characters

A Guildie may manage or represent as a Character only when both of these Blizzard-owned facts are currently true:

```text
Guildie's currently controlled Characters
                ∩
current Blizzard guild Character roster
                ↓
eligible Guild Operations Characters
```

A fresh Blizzard account observation may legitimately reveal every Character controlled through the authenticated account context. Guild Operations may persist those control observations as Blizzard authority evidence, but Characters outside the current guild roster do not enter the Guildie's usable or presentable Character set.

If account refresh reveals a Character that has joined the in-game guild but the persisted guild roster has not yet observed that membership, self refresh does not independently admit the Character. Guild roster authority must establish current membership first.

Likewise, Character profile or media acquisition cannot make an otherwise ineligible Character eligible. It only enriches presentation for Characters whose eligibility has already been established by the intersection above.

## Authority

The caller must:

- have a valid Guild Operations session;
- currently resolve as a member of the configured guild;
- complete a fresh Blizzard OAuth ceremony with `wow.profile`;
- authenticate the same Blizzard principal already bound to the current Guildie.

The server derives the Guildie from the session. The caller never supplies a Guildie identifier to refresh.

A different Blizzard principal cannot migrate, replace, or create Guildie identity through this ceremony. Principal mismatch fails before persistence.

## Ceremony

`GET /me/refresh` creates a short-lived authentication attempt with purpose `self_refresh` and redirects to Blizzard authorization.

The existing Blizzard callback consumes the attempt and distinguishes it from ordinary login.

For self refresh, the repaired ceremony is responsible for:

1. reacquiring the Blizzard authenticated principal and WoW account profile;
2. verifying the browser still carries the same Guildie session that requested the refresh;
3. verifying the Guildie still has current organizational participation;
4. verifying the freshly authenticated Blizzard principal is already bound to that Guildie;
5. reconciling the fresh Blizzard account/control observation without creating a new Guildie;
6. intersecting the newly observed controlled Characters with the persisted current Blizzard guild roster;
7. requesting fresh Character presentation for those eligible Guild Operations Characters;
8. redirecting back to `/me` or the safe local `return_to` supplied when refresh began.

No new Guild Operations session is created by a successful self refresh.

The account/control reconciliation and Character presentation acquisition are separate responsibilities even when performed within one user-facing refresh ceremony. A presentation acquisition failure must not retroactively invalidate an otherwise valid account/control observation.

## Continuity

Previously observed Characters remain historical facts. The newest successful Blizzard account observation determines which Characters are currently controlled by the Guildie.

Changing account or Character-control observations does not create a new Guildie, change the selected main automatically, or rewrite historical guild participation.

The selected main remains a presentation preference over currently eligible Characters. A stored main may remain recorded when its Character is no longer eligible, but it must not grant presentation or authority while that eligibility is absent.

## Blizzard request boundary

Fresh user authorization is required because Guild Operations does not retain Blizzard user access tokens.

The authenticated `/oauth/userinfo` and `/profile/user/wow` authority calls continue through the shared Blizzard authority GET request gate and retry boundary. Self-service initiation does not bypass Blizzard request pacing or retry policy.

Follow-up Character profile/media acquisition uses the same Blizzard request boundary. Reusing that acquisition machinery does not make self refresh responsible for guild-roster authority.
