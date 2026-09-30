# Identity and Member Objects

This document defines Guild Operations' identity model and the member-related facts derived from it.

Guild Operations is a World of Warcraft guild product. Its identity model therefore begins with the identities and facts that are meaningful to operating a WoW guild rather than attempting to model a universal person above every external provider.

## Identity is the stable layer

An **Identity** is a durable identity that Guild Operations recognizes.

Identity answers:

> Who can Guild Operations recognize?

Identity is the stable layer beneath attributes, authority, capabilities, and actions:

```text
Identity
   ↓
Identity attributes and controlled context
   ↓
Authority / capabilities
   ↓
Actions
```

An Identity is not required to be backed by Blizzard. Discord and future concrete authorities may establish identities that Guild Operations can legitimately recognize. Different backing authorities provide different domain context; they do not create different grades of identity validity.

Do not introduce a universal human, person, member, or account-holder object above Identity. Cross-authority relationships are expressed between recognized Identities when concrete product behavior requires them.

## World of Warcraft is the domain anchor

Guild Operations exists to operate around a World of Warcraft guild. The most important identity information it can obtain is therefore an authenticated, GO-recognized **WoW Account Identity**.

A WoW Account Identity is not privileged because Blizzard is universally a superior identity provider. It is privileged because World of Warcraft is the domain Guild Operations exists to serve. A WoW Account unlocks the authoritative context from which GO can understand controlled Characters, the subject guild, guild rank, derived Guildie status, and rank-derived capabilities.

Accordingly:

> **A WoW Account Identity is Guild Operations' canonical domain identity and richest desired form of identification.**

This does not make WoW identity mandatory for every operation. An external Identity may act independently wherever the operation does not require WoW-derived facts.

## Blizzard authentication and the WoW Account boundary

Blizzard authentication establishes an authenticated Blizzard principal/profile and allows Guild Operations to discover the subordinate WoW accounts controlled through that authority.

Conceptually:

```text
authenticated Blizzard principal/profile
        │
        │ reveals / establishes control authority over
        ▼
WoW Account(s)
        │
        ▼
Character(s)
```

The authenticated Blizzard principal/profile is **authentication authority above the Guild Operations Identity boundary**. It is not itself the GO Identity.

Each subordinate WoW account is independently meaningful in the WoW domain: it is independently occupiable in WoW and owns its own Character population. Guild Operations therefore recognizes an individual WoW account as the Identity boundary.

```text
──────── outside GO Identity concern ────────
authenticated Blizzard principal/profile
        │
────────── GO Identity boundary ─────────────
        ▼
WoW Account Identity
        │
        └── controlled Character(s)
```

One authenticated Blizzard principal may reveal multiple WoW Account Identities. Their common authentication authority does not merge or associate them inside Guild Operations.

> **Authentication topology must not become identity topology.**

## Discovery, declaration, establishment, and occupation

External discovery and GO recognition are distinct.

**Discovery** means an external authority has revealed an identity candidate. Discovery alone does not establish a Guild Operations Identity.

For WoW-backed login, Blizzard authentication reveals the WoW accounts available to the authenticated principal. The user selects one. That selection is an implicit declaration of intent to occupy that Identity; it does not require a second confirmation ceremony.

If the selected WoW Account is not yet recognized by GO, GO **establishes** it and continues. Establishment means GO accepts the externally authoritative identity into its own durable identity space.

```text
Blizzard authentication
        ↓
discover WoW Accounts
        ↓
user selects one
        ↓
selection declares intent to occupy
        ↓
GO resolves selected account
        │
        ├── already established → occupy
        └── not established     → establish → occupy
```

GO does not eagerly establish every identity an external provider exposes.

An identity is **occupiable** when both its external authority and Guild Operations recognize it.

For the web application, occupation is the active GO session backed by an established Identity. A separate durable occupation object is unnecessary:

```text
externally recognized identity
        ↓
user declaration / selection
        ↓
established GO Identity
        ↓
session = occupation
```

Signing out ends the session/occupation. It does not destroy the Identity or rewrite history.

## Actor

An **Actor** is an accepted Identity authoring an action.

Actorhood is a role of Identity, not a second durable identity hierarchy. Procedure may constrain whether a particular Actor is allowed to perform an action, but those constraints do not create the Actor.

An Actor has two identity coordinates when origination and canonical resolution differ:

- **subject** — the canonical Identity to which GO resolves and attributes the Actor;
- **origin** — the Identity through which the action entered Guild Operations.

For ordinary self-resolving actions they are the same:

```text
native WoW action
  subject = WoW Identity A
  origin  = WoW Identity A

unassociated Discord action
  subject = Discord Identity B
  origin  = Discord Identity B
```

When an external Identity is associated with a WoW Account Identity, the WoW Account is the canonical Actor subject while the external Identity remains the origin:

```text
Discord Identity C ── association ──► WoW Identity A

Discord-originated action:
  subject = WoW Identity A
  origin  = Discord Identity C
```

The origin preserves truthful ingress/provenance and provider-specific context. The subject is the coordinate downstream domain procedure uses when singular Actor identity matters.

> **Actor subject identifies who GO resolved the author to. Actor origin identifies the Identity through which the action was authored.**

Historical attribution records the Identity coordinate appropriate to the historical fact. Current attributes, rank, capabilities, or representation must not be mistaken for historical Actor identity. Association/reconciliation policy for already-recorded history is a separate concern and must not silently corrupt truthful historical attribution.

## Identity association

Association exists only at the Identity layer.

Every cross-authority association recognized by Guild Operations has exactly one GO-recognized WoW Account Identity as its domain anchor.

```text
GO-recognized WoW Account Identity
              ▲
              │ association
              │
       external Identity
```

Valid association does not form an arbitrary identity graph. External identities are not associated directly to Characters, Guildie status, selected representation, or one another in order to manufacture transitive identity.

The association's consequence for Actor resolution is intentionally asymmetric even if the relationship itself is described conversationally as an association: an associated external Identity resolves to the WoW Account Identity because the WoW Account is GO's canonical domain identity.

Association does not erase either Identity. The external Identity remains independently meaningful as an authority-specific identity and as the origin of interactions through that authority.

This gives three important cases:

```text
WoW Identity A
  → Actor subject A

external Identity B, unassociated
  → Actor subject B

external Identity C, associated to WoW Identity A
  → Actor subject A
  → origin remains C when C authored the interaction
```

An external Identity that cannot resolve to a WoW Account Identity behaves as a **guest Actor**: it is fully identifiable and may act wherever procedure permits, but it has no WoW-backed context from which GO can derive WoW-specific attributes or capabilities.

An associated external Identity is not a guest that has inherited arbitrary powers. It is an ingress identity for an Actor whose canonical subject resolves to a WoW-backed Identity.

## Characters

A **Character** is a durable World of Warcraft context object controlled beneath a WoW Account Identity.

The durable Blizzard Character coordinate is:

```text
region + realm_id + character_id
```

Character control is authoritative external context observed through Blizzard. Characters do not belong to Guildie. Guildie is derived later from Character facts.

A Character may be known through Blizzard's guild roster even when GO has not established the WoW Account Identity that controls it.

Characters remain important recognition surfaces because guildmates commonly recognize one another through Characters. Useful presentation facts may include name, class or active specialization, realm, and current guild rank, but presentation does not establish identity, control, or guild membership.

## Subject guild and Guild Member Character

The **subject guild** is the World of Warcraft guild represented by this Guild Operations installation.

Blizzard owns whether a Character is currently a member of that guild and the Character's numeric guild rank. Guild Operations persists/reconciles those observations without acquiring authority over their underlying truth.

A **Guild Member Character** is a derived classification:

```text
GuildMemberCharacter(character, subjectGuild)
⇔
character has a recognized guild rank in subjectGuild
```

No recognized rank in the subject guild means the Character is not currently a Guild Member Character.

This classification is derived from authoritative Character state. It is not an independently authored or independently authoritative membership record.

## Guildie is a derived Identity attribute

A **Guildie** is not an Identity, Actor, durable person object, or intermediate owner of Characters.

Guildie is a **derived Identity attribute**.

For a WoW Account Identity:

```text
Guildie(identity, subjectGuild)
⇔
∃ character ∈ ControlledCharacters(identity):
    character has a recognized rank in subjectGuild
```

Therefore:

```text
Identity controls ≥1 Guild Member Character
    → Identity currently has Guildie attribute

Identity controls 0 Guild Member Characters
    → Identity does not currently have Guildie attribute
```

The Guildie attribute can appear or disappear as authoritative Character control or subject-guild roster facts change. The Identity remains stable.

Guildie must not be independently authored or persisted as a competing source of membership truth. An implementation may cache/materialize a derived result for operational reasons, but the authoritative meaning remains derivable from Identity, Character control, and subject-guild rank.

Terms such as `guildie.joined` or `guildie.left`, if retained, describe transitions of this derived attribute. They do not describe creation or destruction of Identity.

> **Derived means derived.**

## Rank and capability

Blizzard owns the numeric guild rank of each current subject-guild Character. Guild Operations owns what those ranks permit inside Guild Operations.

Rank is a Character-level authoritative fact. Rank-derived capability is evaluated from the subject-guild ranks of Characters controlled by the relevant WoW Account Identity.

A selected Character representation does not determine authority.

The dependency remains:

```text
WoW Account Identity
        ↓ controls
Character(s)
        ↓ subject-guild rank
derived Guildie / effective authority
        ↓
GO capabilities
```

An external guest Actor has no WoW Character/rank context and therefore cannot satisfy constraints that require Guildie, Guild Member Character, or rank-derived capability. This does not make the external Identity invalid. It means the requested operation requires facts that Identity cannot supply.

Open or `Any` operations may accept such an Actor without requiring WoW context.

> **Identity determines who is an Actor. Subject-guild rank determines when WoW guild authority permits that Actor to act.**

## Identity attributes and representation

Identity attributes describe a stable Identity according to the authority appropriate to each attribute.

Attributes may have different authorities:

- **Guildie** is derived by GO from Blizzard-authoritative Character facts.
- **Representation** is declarable by the user.

**Representation** answers how an Identity should be presented where GO permits a choice of representation. A selected main Character and a nickname are examples of the same class of work: choosing representation.

Representation does not establish Identity, Character control, Guildie status, rank, capability, or Actor attribution.

A representation may become unavailable when the context supporting it changes without destroying the Identity or rewriting historical actions.

Do not create a second identity layer merely to model representation.

## Participation and Actor resolution

Activity procedures consume Actors; they do not own cross-authority identity resolution.

A Participation Offer represents one Actor. When associated identities are involved, the Offer is keyed to the resolved Actor **subject**, not independently to every Identity that can originate actions for that Actor.

```text
WoW Identity A ───────────────────┐
                                  ├─ Actor subject A → one Offer
associated Discord Identity C ────┘
```

An unassociated external Identity remains independently resolvable:

```text
Discord Identity B
    ↓
Actor subject B
    ↓
valid Offer where procedure permits guest / Any participation
```

Association is therefore not a prerequisite for participation merely because the interaction originated externally. It matters when WoW-backed context is required or when multiple ingress identities must resolve to one Actor.

A procedure may constrain Actors by current derived facts or require fulfillment from WoW context. Those constraints answer whether/how an already-recognized Actor may participate; they do not determine whether the Identity is legitimate.

## Subject is contextual language

Guild Operations has no universal persisted domain object called **Subject**.

A subject is contextual language for the object currently designated by a statement, question, event, or operation. Actor `subject` is a specific identity-resolution coordinate within the Actor contract; it does not establish a universal `Subject` domain object.

Persist and name actual objects and relationships. Do not introduce a generic `subject_id` merely as a shortcut for unrelated domains.

## Choosing the right coordinate

Use **Identity** for durable recognition and cross-authority association.

Use **WoW Account Identity** as GO's canonical domain identity and the anchor for every external identity association.

Use **Actor subject** for the canonical Identity to which an authored action resolves.

Use **Actor origin** when the ingress identity or provider-specific provenance matters.

Use **Character** for a specific WoW Character and Character-level Blizzard facts.

Use **Guild Member Character** as the derived classification that a Character currently has a recognized rank in the subject guild.

Use **Guildie** as the derived Identity attribute that the Identity controls at least one Guild Member Character.

Use **Representation** for declarable presentation choices, not identity or authorization.

Use **capabilities** at operation boundaries when a real operation requires authorization.

Use **guest** for an Actor whose subject remains an external Identity because no WoW Account association resolves it into GO's domain anchor.

## Doctrine boundary

These are semantic rules, not a persistence migration plan.

The current implementation may still use `guildie_id`, Blizzard-principal-rooted ownership, Guildie-scoped sessions, Guildie-scoped authority, or direct Guildie↔Discord associations. Those structures are implementation debt relative to this doctrine and must be audited according to what each persisted coordinate actually means.

Do not mechanically rename every `guildie_id` to `identity_id`. Determine whether each use means Identity, Actor attribution, representation ownership, current derived Guildie state, authority, preference ownership, or a concrete procedure-owned historical fact.

Likewise, this doctrine does not yet prescribe retroactive reconciliation when a previously guest external Identity is later associated with a WoW Account Identity. Historical attribution must remain truthful; reconciliation policy should be earned and specified separately rather than smuggled into the definition of Identity.

> **Stabilize the Identity. Then determine what that Identity is allowed to do.**
