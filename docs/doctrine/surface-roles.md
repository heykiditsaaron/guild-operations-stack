# Participation, Operations, and Administration

Guild Operations distinguishes three application surface roles because privileged access alone does not determine where a capability belongs.

## Participation

Participation surfaces let guild members take part in a guild activity.

Examples include signing up for a raid, claiming raffle entries, submitting an answer, or otherwise joining a concrete guild procedure.

Participation belongs with the activity being participated in.

## Operations

Operational surfaces let authorized guild members run, advance, adjudicate, or resolve a concrete guild activity or process.

Examples include creating or managing a raid, opening or drawing a raffle, adjudicating raffle claims, reconciling an external projection, or manually refreshing Blizzard-backed guild state.

Operations remain with the domain or process being operated. A capability does not become administrative merely because only privileged members may invoke it.

> Authority controls access. It does not determine information architecture.

## Administration

Administration configures how Guild Operations is allowed to provide and govern capabilities.

Administration owns durable configuration and policy rather than the execution of ordinary privileged work.

The stable global administrative concerns are:

```text
Administration
├── General
└── Permissions
```

### General

General owns application and module configuration, including module lifecycle state where the application has earned it.

Module lifecycle concepts remain distinct:

```text
availability / entitlement
        ↓
enablement
        ↓
configuration readiness
        ↓
operational use
```

Current implementation only needs concrete states already required by Guild Operations, such as packaged-module enablement and configuration readiness. Future licensing or commercial entitlement may resolve availability without changing the meaning of enablement or module operation.

Do not build speculative commerce or licensing machinery merely because the lifecycle seam can support it later.

### Permissions

Permissions owns configurable authorization policy.

A capability may exist without being administratively configurable. When guild policy is configurable, Administration provides the consistent place to change that policy while backend authority and capability enforcement remain authoritative.

Capability definition, authorization enforcement, and administrative configuration are separate concerns.

## Module relationship

A module may participate in one, two, or all three surface roles.

For example, a module may have member participation and privileged operations but no configurable administration beyond global enablement. Another module may primarily provide integration configuration and operational reconciliation.

Modules do not receive top-level administrative destinations merely because they exist. They contribute only configuration or configurable permission policy that has actually been earned.

Enabling or disabling a module is administration. Operating an enabled module is not.

## Navigation consequence

Administration is discovered globally because configuration and governance are global concerns.

Operations are discovered contextually from the domain or process being operated. A raid operator should operate Raid from Raid; a raffle operator should operate Raffle from Raffle.

Operational inspection is privileged support for operations. It is not administration merely because access is restricted.

## Growth rule

Do not introduce a generic administration, operation, module-lifecycle, entitlement, or permission-contribution framework before multiple concrete features prove the required contract.

Build the concrete surfaces first. Let shared contribution machinery reveal itself under pressure.
