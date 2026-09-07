# Main Character Selection

## Purpose

Main-character selection is the first Guild Operations-owned member decision layered on top of Blizzard authority.

Blizzard establishes which Characters an authenticated Guildie controls and which of those Characters are currently members of guild `65431436`. Guild Operations allows the Guildie to choose one currently eligible guild Character as their main operational representation.

## Authority boundary

Blizzard owns:

- authenticated Blizzard account authority;
- which Characters that authority establishes as currently controlled by the Guildie;
- current membership of a Character in the WoW guild;
- the Character's current numeric guild rank.

Guild Operations owns:

- durable Guildie continuity through `guildie_id`;
- which currently eligible guild Character the Guildie has selected as their main.

A selected main is not identity or authorization. Changing it does not create a new Guildie, change Blizzard account authority, or rewrite participation history.

## Canonical selection

A selection is addressed by the durable Character coordinate:

`region + realm_id + character_id`

Character name and realm name are presentation, not selection identity.

A Guildie may select a Character only when the current persisted Blizzard observations establish both:

1. the Guildie currently controls that Character; and
2. that Character is currently present on the roster of guild `65431436`.

The API rejects arbitrary or currently ineligible Character coordinates.

## Loss of eligibility

Roster synchronization does not destroy a prior main selection when Blizzard no longer reports the Character as a current guild member. The selection remains first-party historical state, while its projection reports that it is no longer currently eligible.

A stale selection therefore does not become false history and does not confer current guild eligibility.

## HTTP surface

`GET /me` projects the current main selection alongside the Guildie's currently eligible guild Characters and identifies the Guildie with `guildie_id`.

`PUT /me/main-character` accepts `realm_id` and `character_id` for an authenticated Guildie and changes the selection only after current eligibility is established.

`Subject` is not part of selected-main ownership or persistence; it is contextual language only.
