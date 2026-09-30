# Main Character Selection

## Purpose

Main-character selection is an Identity-owned representation preference.

It answers a narrow presentation question:

> If Guild Operations must represent this Identity as a Character, and the surrounding context has not explicitly established which Character is relevant, which Character does the Identity owner prefer as the fallback?

The selected main does not universally represent the Identity. A procedure that already carries a Character-specific context, such as Character-specific raid participation, may use that explicit Character instead.

## Authority boundary

Blizzard-observed state establishes which Characters a WoW Account Identity currently controls and which Characters are currently members of the subject guild. Guild Operations owns the Identity user's main-Character selection.

A selected main is presentation preference, not identity or authorization. Changing it does not establish Identity, Character control, Guildie status, rank, capability, participation, or Actor attribution.

## Selection

A user may select a Character as their main only when current persisted observations establish both:

1. the Identity currently controls that Character; and
2. that Character is currently present on the subject guild roster.

The HTTP surface accepts the external Character coordinate needed to identify the requested Character. Once resolved, GO persists the preference as a reference to the existing Character record through `character_record_id`; Character facts remain owned by Character authority.

Character name, realm name, and other presentation facts are not copied into the preference.

## Loss of eligibility

Roster or control reconciliation does not destroy a prior main selection when the Character ceases to be currently eligible. The Identity-owned preference remains selected while its projection reports that it is no longer currently eligible.

A stale preference therefore does not become false history and does not confer current guild eligibility or authority.

## HTTP surface

`GET /me` projects the current main-Character preference alongside the Identity's currently eligible guild Characters.

`PUT /me/main-character` accepts `realm_id` and `character_id` for the authenticated Identity and changes the preference only after current eligibility is established.

The current implementation scopes the preference to the installation's bound guild. That persistence scope is not a declaration that Representation as a general Identity concept is necessarily guild-scoped.
