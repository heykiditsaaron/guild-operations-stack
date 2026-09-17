# Raid

Raid is one of Guild Operations' first complete participation-event reference modules. Together with Raffle, it demonstrates how a concrete module owns its authority, lifecycle, participation, operation, and presentation without turning those choices into generic event machinery.

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
├── immediately accepting participation commitments
│   ├── definition may be modified by authorized operators
│   ├── signup commitments may be created or withdrawn
│   └── assignments may establish roster participation
│
├── occursAt arrives
│
└── historical Raid
    ├── definition preserved
    ├── signup commitments preserved
    └── assignments preserved
```

There is no independent Raid signup window or persisted open/closed signup stage. The Raid's existence before occurrence is the commitment window.

At or after `occursAt`, history is derived from time rather than written as a lifecycle transition. No scheduler or background transition is required. Historical Raids are read-only.

Before occurrence, cancellation is destructive. Cancelling removes the Raid and its dependent signup commitments and assignments and withdraws its event publication. A cancelled Raid does not survive as Raid history.

The Raid Operations page therefore separates upcoming operational work from surviving historical Raids. Historical presentation is intentionally minimal until a concrete Raid feature earns richer history such as outcomes, logs, attendance, or analytics.

## Participation commitment

A Raid signup is a participation commitment: the applicant's declaration that they intend to participate and what they are willing to bring if selected.

An applicant supplies an identity plus either a controlled eligible character or, when the Raid permits anyone, a declared class, and the specializations they are willing to play.

The applicant does not declare a Raid role directly. Raid derives willing roles from the class and specialization trait index. An assignment can only use a role supported by a specialization the applicant offered.

An applicant may have multiple active signup commitments. The public listing's signup count is the number of distinct applicants with at least one active commitment, not the number of signup rows.

Before occurrence, an applicant owns withdrawal of their own commitment. If that commitment has been assigned, withdrawal removes the assignment transactionally rather than silently transferring it to another signup.

A signup is evidence of intent, not evidence that the applicant attended the Raid. Guild Operations must not reinterpret signup or assignment as observed attendance merely because those facts are available before occurrence.

## Assignment and established participation

Assignment is operator-owned Raid work. An operator accepts and organizes an active signup commitment into the intended Raid roster by selecting a specialization and compatible Raid role from what the applicant offered.

Assignment therefore establishes the Raid's planned participation configuration. It does not mechanically cause the human activity to occur and does not prove later attendance. Actual Raid participation is only observable after the fact if a future Raid capability establishes legitimate attendance evidence.

The Raid listing summarizes only the current assigned composition: Tanks, Healers, and Damage. It does not expose assignment mutation controls, capacity targets, roster diagnostics, or participant identities.

## Surfaces and destinations

Each Raid declares navigable destinations for its concrete surfaces:

- `public` — the Raid event listing;
- `participate` — Raid signup commitments; and
- `operate` — Raid management.

Destinations describe where a surface exists. Their presence does not grant authority to use it; authorization remains enforced by the relevant application operation and surface.

The public listing is the canonical public expression of one Raid event. It presents the Raid's occurrence and definition, eligibility, readiness requirements, signup summary, current assigned composition when present, and appropriate destinations/actions.

Management has two human-facing modes:

- **Assign** for commitment handling and roster assignment work;
- **Edit** for the mutable Raid definition and destructive cancellation when authorized.

Historical Raid surfaces preserve the established facts, signup commitments, and assignments but do not permit mutation.

## Presentation

Designation labels are defaults rather than immutable copy. A projection may use clearer local wording while preserving the same underlying meaning and value. For example, an eligibility fact may be presented as `Who can apply`, and the participate destination may be rendered as `Sign Up`.

Raid descriptions remain plain persisted text. The listing supports paragraph breaks plus the small presentation vocabulary `**bold**` and `*italics*`; this is not a general Markdown or rich-content contract.

## Application boundary

Raid behavior belongs to Raid application operations. HTTP routes and web surfaces adapt representations into those operations rather than reimplementing lifecycle or authority rules.

Current consequential operations include creation, modification, cancellation, signup commitment submission and withdrawal, assignment, and unassignment. Read models support the public listing, participation surface, assignment operation, and Raid Operations overview.

## Relationship to other participation events

Raid and Raffle are paired reference implementations for Guild Operations participation-event modules. Both currently demonstrate a participant-authored commitment followed by operator-owned establishment, but the meaning and procedure remain module-owned: Raid operators organize a commitment into an intended roster, while Raffle operators verify a promised payment and establish drawing weight.

Their execution then diverges. Raid is a human activity Guild Operations cannot mechanically enforce; Raffle can mechanically consume established drawing weight during its draw. Neither commitment nor Raid assignment should be promoted into evidence of actual attendance without an authority-bearing observation that establishes it.

Other participation events need not contain the same stages. In Hidden in Plain Sight, for example, a submission can be both the participation commitment and the participation itself, with later adjudication determining success rather than whether participation occurred.

These examples establish useful vocabulary, not a shared participation workflow. Participation windows, cancellation semantics, history, eligibility, assignment, adjudication, execution, and evidence remain module behaviors unless repeated concrete modules prove a narrower shared abstraction is warranted.
