# Raffle Operational Inspection

Raffle publishes to global operational inspection only when it deliberately identifies an abnormal condition that is useful for administrators to inspect.

Normal raffle participation and lifecycle activity does not belong in the operational log. Claims, adjudication, Raffle state, conclusions, winners, and other ordinary Raffle truth remain authoritative in Raffle and are already preserved through its public and administrative records.

Raffle operational-inspection publication is best effort. Failure to write an inspection record must not alter, roll back, or reinterpret an authoritative raffle operation; publication failure remains runtime logging.

## Source

Raffle publishes with:

```text
source = raffle
```

## Current exception coordinates

### `raffle.draw`

`kind = exception`

Published when Raffle has successfully concluded a Raffle as `drawn` but the resulting Raffle does not carry the winning-claim coordinate required by the concluded draw contract.

The record identifies the acting Guildie when available and includes the Raffle coordinate and recorded conclusion. It does not duplicate the raffle claim ledger, drawing population, or selection machinery.

## Boundary

Adding a raffle operation does not automatically add an operational record. A condition earns publication only when Raffle deliberately determines that the abnormal outcome is administratively useful beyond ordinary raffle history.

Operational inspection is not Raffle's audit history, event bus, runtime exception mirror, or integration-publication mechanism.
