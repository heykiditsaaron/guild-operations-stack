# Main Character Selection

## Purpose

Main-character selection is the first Guild Operations-owned member decision layered on top of Blizzard authority.

Blizzard establishes which characters an authenticated subject controls and which of those characters are currently members of guild `65431436`. Guild Operations allows the subject to choose one currently eligible guild character as their main operational representation.

## Authority boundary

Blizzard owns:

- authenticated subject continuity;
- character ownership beneath that subject;
- current membership of a character in the guild;
- the character's current numeric guild rank.

Guild Operations owns:

- which currently eligible guild character the subject has selected as their main.

A selected main is not identity. Changing it does not create a new subject, change Blizzard ownership, or rewrite participation history.

## Canonical selection

A selection is addressed by the durable character coordinate:

`region + realm_id + character_id`

Character name and realm name are presentation, not selection identity.

A subject may select a character only when the current persisted Blizzard observations establish both:

1. the subject controls that character; and
2. that character is currently present on the roster of guild `65431436`.

The API rejects arbitrary or currently ineligible character coordinates.

## Loss of eligibility

Roster synchronization does not destroy a prior main selection when Blizzard no longer reports the character as a current guild member. The selection remains first-party historical state, while its projection reports that it is no longer currently eligible.

A stale selection therefore does not become false history and does not confer current guild eligibility.

## HTTP surface

`GET /me` projects the current main selection alongside the subject's currently eligible guild characters.

`PUT /me/main-character` accepts `realm_id` and `character_id` for an authenticated subject and changes the selection only after current eligibility is established.
