# Raid

Raid is Guild Operations' first complete participation-event archetype. It establishes one concrete module's authority, lifecycle, participation, operation, and presentation without turning those choices into generic event machinery.

## Event identity

A Raid is an event kind. Each persisted Raid is one specific Raid event with its own occurrence, listing, participation, and operational surfaces.

The Raid owns its event facts. Other surfaces may project those facts, but they do not own Raid lifecycle or participation state.

## Definition

Creation establishes:

- name;
- optional description;
- occurrence;
- difficulty;
- participation eligibility; and
- optional informational readiness requirements.

Eligibility is required at creation. The web authoring surface defaults the selection to `Anyone`, but the application contract does not infer eligibility when it is omitted.

Eligibility is immutable after creation. It remains visible as a Raid fact on the public listing and in Edit, but Edit cannot change it.

Before occurrence, an authorized operator may modify the name, description, occurrence, difficulty, and readiness requirements. Raid names are limited to 80 characters and descriptions to 1,400 characters.

Readiness requirements communicate expectations to participants. Guild Operations does not mechanically enforce them.

## Lifecycle

Raid lifecycle is occurrence-driven:

```text
Raid created
│
├── immediately accepting participation
│   ├── definition may be modified by authorized operators
│   ├── participation offers may be created or withdrawn
│   └── assignments may be operated
│
├── occursAt arrives
│
└── historical Raid
    ├── definition preserved
    ├── participation preserved
    └── assignments preserved
```

There is no independent Raid signup window or persisted open/closed signup stage. The Raid's existence before occurrence is the participation window.

At or after `occursAt`, history is derived from time rather than written as a lifecycle transition. No scheduler or background transition is required. Historical Raids are read-only.

Before occurrence, cancellation is destructive. Cancelling removes the Raid and its dependent participation and assignments and withdraws its event publication. A cancelled Raid does not survive as Raid history.

The Raid Operations page therefore separates upcoming operational work from surviving historical Raids. Historical presentation is intentionally minimal until a concrete Raid feature earns richer history such as outcomes, logs, attendance, or analytics.

## Participation

A Raid participation offer is a participant's declaration of what they could bring to the Raid.

A participant supplies an applicant identity plus either a controlled eligible character or, when the Raid permits anyone, a declared class, and the specializations they are willing to play.

The participant does not declare a Raid role directly. Raid derives willing roles from the class and specialization trait index. An assignment can only use a role supported by the selected specialization.

An applicant may have multiple active participation offers. The public listing's signup count is the number of distinct applicants with at least one active offer, not the number of offer rows.

Before occurrence, a participant owns withdrawal of their own offer. If that offer is assigned, withdrawal removes the assignment transactionally rather than silently transferring it to another offer.

## Assignment

Assignment is operator-owned Raid work. Operators assign from active participation offers and select a specialization and compatible Raid role.

The Raid listing summarizes only the current assigned composition: Tanks, Healers, and Damage. It does not expose assignment mutation controls, capacity targets, roster diagnostics, or participant identities.

## Surfaces and destinations

Each Raid declares navigable destinations for its concrete surfaces:

- `public` — the Raid event listing;
- `participate` — Raid participation; and
- `operate` — Raid management.

Destinations describe where a surface exists. Their presence does not grant authority to use it; authorization remains enforced by the relevant application operation and surface.

The public listing is the canonical public expression of one Raid event. It presents the Raid's occurrence and definition, eligibility, readiness requirements, signup summary, current assigned composition when present, and appropriate destinations/actions.

Management has two human-facing modes:

- **Assign** for participation and group assignment work;
- **Edit** for the mutable Raid definition and destructive cancellation when authorized.

Historical Raid surfaces preserve the established facts and participation but do not permit mutation.

## Presentation

Designation labels are defaults rather than immutable copy. A projection may use clearer local wording while preserving the same underlying meaning and value. For example, an eligibility fact may be presented as `Who can apply`, and the participate destination may be rendered as `Sign Up`.

Raid descriptions remain plain persisted text. The listing supports paragraph breaks plus the small presentation vocabulary `**bold**` and `*italics*`; this is not a general Markdown or rich-content contract.

## Application boundary

Raid behavior belongs to Raid application operations. HTTP routes and web surfaces adapt representations into those operations rather than reimplementing lifecycle or authority rules.

Current consequential operations include creation, modification, cancellation, participation submission and withdrawal, assignment, and unassignment. Read models support the public listing, participation surface, assignment operation, and Raid Operations overview.

This module is a reference implementation for pressure-testing later modules, not a mandate that every module share Raid's lifecycle. In particular, participation windows, cancellation semantics, history, eligibility, and assignment are module behaviors unless repeated concrete modules prove a narrower shared abstraction is warranted.
