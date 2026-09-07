# Blizzard Request Boundary

This infrastructure defines shared HTTP behavior for Blizzard authority GET requests made by Guild Operations.

Use this boundary rather than implementing independent pacing or retry behavior in individual acquisition procedures.

## Request gate

Blizzard authority GET requests share one request gate currently limited to:

```text
10 requests per second
```

Callers do not bypass the gate merely because their request originates from a manual action, automatic scheduler, authentication ceremony, guild reconciliation, or Character presentation acquisition.

## Retry behavior

The shared boundary retries:

- HTTP `429` responses;
- HTTP `5xx` responses.

When Blizzard supplies `Retry-After`, the boundary honors it. Otherwise retries use exponential backoff.

A caller receives the eventual acquisition result or failure after this shared behavior has been applied rather than implementing its own competing retry loop.

## Current callers

The boundary is used by Blizzard authority GET acquisition including:

- authenticated account authority acquisition (`/oauth/userinfo` and `/profile/user/wow`);
- guild profile and roster acquisition;
- Character Profile acquisition;
- Character Media acquisition.

## Excluded operations

OAuth authorization-code exchange and token acquisition are authentication/token operations rather than Blizzard authority GET acquisition. They remain outside this request gate.

## Ownership rule

This boundary owns request pacing and retry behavior only. Callers continue to own:

- why the request is being made;
- which Blizzard resource is authoritative for their procedure;
- target selection;
- corroboration beyond generic HTTP handling;
- persistence and domain interpretation of the response.

Changing shared request pacing or retry policy should therefore happen here rather than independently inside each consuming procedure.
