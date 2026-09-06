# Module Creation Guidance

Guild Operations modules should be built around concrete guild participation capabilities rather than generalized framework machinery.

A module should establish or operate a real guild activity, preserve its history, or provide the authority needed to participate in it. Shared abstractions should emerge from repeated real pressure rather than being designed in advance.

## Source ownership

Concrete participation modules belong under `src/modules/<module>/` once the application has earned a module boundary for that capability. This is an implementation ownership boundary, not a requirement that source layout mirror member-facing URLs.

A module may contribute Guild Event Calendar Listings without being contained by Guild Events or by the calendar. Shared Guild Event calendar infrastructure belongs to `src/guild-events/calendar/`, while a member-facing calendar projection may still appropriately live under `src/web/pages/events/`.

A module may also register a Guild Event Offering when the Events shell should promote that enduring kind of guild participation independently of whether a concrete occurrence is live or scheduled. Shared Offering contract machinery belongs to `src/guild-events/offerings/`. The Offering gives the shell enough semantic material to promote the activity and route members into its module-owned informational surface; it does not move explanation, procedure, administration, or history into the shell.

Raffle is the current concrete example: raffle procedure and truth belong to `src/modules/raffle/`, while `/events/raffle` remains the appropriate member-facing route and raffle rounds may be contributed to the Guild Event Calendar.

### Guild Event participation surfaces

When creating a participation module that belongs in the Guild Events experience, treat the Offering and Calendar as separate shared projections over module-owned truth:

```text
Guild Event Offering
    → What participation does the guild offer?

Guild Event Calendar Listing
    → What concrete occurrence happens when?

Module destination
    → What is this activity, and how does participation work?
```

A module should register a Guild Event Offering when the activity itself should remain discoverable on `/events` even when no occurrence is currently scheduled. The current Offering contract supplies a stable offering identifier, member-facing title, promotional tagline, member-facing destination, and optional artwork. Artwork may be a bundled application asset or an external image URL; it is a recognition resource, not a layout instruction. The Events shell owns the card or other promotional treatment and must remain useful when artwork is absent. See [`guild-event-offerings.md`](guild-event-offerings.md) for the contract.

A module should establish Guild Event Calendar Listings only for concrete occurrences that have temporal meaning. The module owns whether an occurrence exists and the best-known time at which it occurs; the Calendar owns the shared temporal listing contract. The module must update or withdraw its listings as its owned occurrence truth changes. See [`guild-event-calendar.md`](guild-event-calendar.md) for the contract.

Do not make an Offering depend on a current Calendar Listing. An enduring activity may have zero scheduled occurrences. Likewise, do not put rules, eligibility, administration, history, or module procedure into either shared projection merely because `/events` consumes them. Those meanings remain module-owned and belong on the module's own surfaces.

The current `/events` calendar presentation is intentionally treated as one cohesive calendar widget: its heading, status groups, and listings form a single consumer-owned presentation unit over Calendar truth. Modules do not position, style, or configure that widget. Its placement may change as the Events shell learns from additional modules and different screen sizes without changing the Calendar Listing contract.

The `src/modules/` container does not imply a generic module loader, registry, lifecycle, or framework. Add shared module machinery only when multiple concrete participation capabilities demonstrate that the same machinery is actually needed.

## Persistence and shared authority

A module owns the persistence of the participation truth it establishes. It does not duplicate persistence owned globally by Guild Operations.

The application-wide ownership boundary is defined in [`global-persistence.md`](global-persistence.md). Module authors should orient against that shared state rather than recreate it locally.

Global Guild Operations owns shared authoritative facts and objects such as Guildies, controlled Characters, current Blizzard guild roster observations, Blizzard rank observations, and other application-wide authority state.

A module may reference those globally owned objects while persisting the module-specific meaning of their participation. Referencing a Guildie, Character, guild, rank, or other global coordinate does not transfer ownership of that object or fact to the module.

Current membership is likewise referenced, not recreated. Modules use the globally observed Character roster and globally derived Guildie participation state when membership matters. A module may persist that a Guildie or Character participated in its procedure, but that historical participation fact does not become a competing source of current membership or rank truth.

A module must not copy current membership into module state and later treat that copy as authoritative, infer guild membership from the presence or absence of module records, or overrule globally established membership and rank facts.

A module should name the actual object and relationship it persists. `Subject` is contextual language, not a global object or persistence coordinate, and must not be introduced as a generic module reference.

Modules remain subject to application-wide persistence laws and conventions even when the persisted facts belong to the module.

## Permissioning

Global Guild Operations owns permissions for globally owned operations and exposes globally authoritative member, roster, rank, and authority facts.

Modules consume those facts and global permissions as inputs. A module owns permission policy that belongs specifically to its participation procedure.

Module authorization may derive a module-specific decision directly from current global authority facts, require an existing globally owned permission, or introduce module-specific permission state when a real module requirement proves that additional state is necessary. These mechanisms may coexist; ownership determines which layer defines the rule.

A module capability is a semantic permission, not necessarily a globally persisted grant. A module may define a capability such as `raffle.admin` and evaluate it from current global facts without registering that capability as global permission state.

Modules should not duplicate globally owned roster, rank, Guildie, Character, or authority state merely to make a permission decision. Global facts remain globally owned; the module owns only its interpretation of those facts for its own procedure.

Using global permission machinery does not transfer ownership of module-specific permission policy to the global layer. Conversely, a module should not reimplement globally owned permission semantics merely because it has local authorization needs.

The default for a new module is to begin with existing global facts and permissions. Add module-specific permission machinery only when the module's procedure demonstrates a need that those inputs cannot express directly.

## Rendering ownership

Use the broadest rendering owner that has already been earned by the application.

### Prefer global rendering

If presentation belongs to the shared application language, let the global renderer own it.

Examples include:

- application shell structure
- primary navigation
- secondary navigation
- shared navigation semantics
- shared navigation spacing, casing, collapse, separators, and current-state treatment

Modules should declare the semantic information the global renderer needs rather than reproducing global presentation locally.

For secondary navigation, this means the module declares navigation intent and hierarchy while the shared renderer owns the resulting semantics and presentation. Breadcrumb order is significant: the terminal item is the module's declaration of the current location.

The Guild Event Calendar follows the same ownership rule. Modules establish calendar listings; calendar consumers and shell surfaces own how those listings are organized and presented in their medium. The same calendar truth may therefore support multiple presentations without moving presentation ownership into the producing module.

Guild Event Offerings follow that rule as well. A module registers the offering identity, title, promotional tagline, member-facing destination, and optionally an artwork coordinate. The Events shell owns whether that contribution becomes a card, banner, tile, or another shared promotional treatment, including how optional artwork is resolved and laid out. Modules must not register shell markup, layout instructions, or arbitrary presentation metadata through the Offering contract.

### Attach module-specific rendering

When presentation genuinely belongs to a module and is reused across that module, attach it to the module rather than promoting it into the global renderer.

This is appropriate for presentation that expresses module-specific concepts, states, controls, or recurring surfaces without being part of the application's shared visual language.

A module-specific renderer should remain scoped to the module unless another real feature demonstrates that the same ownership belongs somewhere broader.

### Use inline rendering only when exceptional

Inline rendering is appropriate when the presentation belongs only to one exceptional page, state, or interaction and has no demonstrated reusable owner.

Do not extract one-off presentation merely to avoid inline code. Do not promote exceptional presentation into module or global rendering until repeated use proves that a broader owner exists.

## Rendering hierarchy

The preferred order is:

1. Global render, when the application owns the presentation.
2. Module-specific render, when the module owns reusable presentation.
3. Inline render, when the surface is genuinely exceptional.

This is an ownership hierarchy, not a rule that every piece of markup must be abstracted. Start at the broadest already-earned owner, but do not move presentation upward simply to make code look more reusable.

Global rendering should not become a dumping ground. Module rendering should not become a speculative design system. Inline rendering should not become the default for concepts that are clearly shared.

## Navigation and page identity

Navigation presentation is global shell behavior. Page and module identity presentation is local.

The shell owns navigation concerns such as:

- hierarchy presentation
- active and current treatment
- spacing
- casing
- collapse and overflow behavior
- separators
- responsive behavior

The module owns identity cues such as page titles, section labels, event states, status treatments, and other presentation whose meaning belongs to the module itself.

Do not use page-specific identity styling to recreate navigation behavior, and do not push module identity into the global navigation renderer.

## General guidance

Build the guild activity first. Let common machinery reveal itself under real use.

Prefer concrete module boundaries over generalized infrastructure. Prepare inexpensive semantic seams for likely future expression when justified, but do not create speculative features or frameworks around them.

When a module needs shared behavior, first ask which layer legitimately owns that behavior. Reuse should follow ownership; ownership should not be invented merely to create reuse.
