# WoW Trait Index

## Purpose

The WoW Trait Index is a small factual registry of game-authored class and specialization capabilities that can reduce the mental bookkeeping involved in evaluating an assembled group.

It is an index, not a composition engine.

A consumer can resolve a character's class and active specialization into useful capabilities and present those capabilities as an **Available capabilities** scoreboard. The consumer decides whether any capability matters.

## Authority boundary

Traits represent useful facts grounded in World of Warcraft mechanics. Guild Operations normalizes those facts into stable keys; it does not invent judgments about a specialization.

The index records what a class or specialization can bring. It does not assert that a capability is present in the participant's current loadout.

This means a capability may be indexed when it is available through the class or specialization even when the player may need a valid talent, pet, or other ordinary configuration choice to provide it.

The index does not record:

- requirements or desired composition;
- scores, weights, priorities, or recommendations;
- current talent/loadout verification;
- whether a participant has been selected because of a capability;
- whether an organizer should ask a participant to change configuration;
- subjective descriptions such as strong utility, good mobility, or physical-heavy damage.

Those decisions belong to the consuming activity and, ultimately, its human organizer.

## Class and specialization inheritance

Facts shared by a class are recorded once at class level. Specialization-specific facts are recorded at specialization level.

The effective trait set for a specialization is the union of both:

```text
Mage
├── armor.cloth
├── buff.arcane_intellect
└── ...

Arcane
└── role.damage

Arcane Mage effective traits
= Mage traits + Arcane traits
```

This preserves the game's natural ownership of a capability without forcing consumers to understand inheritance themselves.

## Initial vocabulary

The registry begins with deliberately useful mechanical categories:

- `role.*` — tank, healer, or damage role;
- `armor.*` — cloth, leather, mail, or plate armor;
- `buff.*` — recognizable group or raid buffs;
- `effect.*` — normalized mechanically equivalent group effects such as Bloodlust or combat resurrection;
- `dispel.harm.*` — removal of harmful effects from allies;
- `dispel.help.*` — removal of helpful effects from enemies;
- `control.*` — useful control capabilities such as interrupts and stuns.

The vocabulary is inherently extensible. New traits should be added when a game-authored capability proves useful to group evaluation, not because every possible WoW mechanic needs to be catalogued.

## Consumer contract

The primary lookup is:

```ts
traitsForSpec(className, specName)
```

It returns the effective class-plus-specialization trait set.

A roster or activity can union those sets across assigned participants and display the result. The index itself performs no scoring, coverage evaluation, recommendation, or assignment.

```text
assigned roster
      ↓
class + active specialization
      ↓
WoW Trait Index
      ↓
available capabilities
      ↓
human organizer judgment
```

## Presentation principle

Consumers should describe the result as **available capabilities** or equivalent language. The result is possibility derived from the assigned roster, not verification of the players' current builds.

Guild Operations provides the scoreboard. The organizer plays the game.
