# Modnet Translation

> Status: lineage / migration note (non-normative for active doctrine).

## Why This Page Exists

This page preserves how Modnet-era vocabulary maps into the active dual-lane + boundary-contract doctrine.

## Translation Summary

| Legacy Term | Active Doctrine Translation |
|---|---|
| Modnet shared-interface framing | Exchange-lane boundary contracts over data/resources/services/provenance |
| Shared UI assumptions | Local projection only; UI is not interoperability unit |
| `scale` ladder semantics | Transitional compatibility only; replace with explicit audience/scope/granularity metadata |

## Current vs Target

### Implemented now

- No source-backed global boundary-contract graph engine exists yet.
- Legacy terms may still appear in historical docs and lineage references.

### Target direction

- Active interoperability doctrine is BCG + node-to-node auth + capability-token execution authority.
- Legacy terms are lineage context, not normative runtime policy.

## Transitional Compatibility Rule

`scale` may be retained only as compatibility metadata when needed for migration. New active doctrine guidance should use explicit contract fields (`audience`, `scope`, `delegation`, `expiry`, `entitlement`, `provenance`) instead of legacy scale semantics.

## Related

- [Dual-Lane HyperNode Model](dual-lane-node-model.md)
- [Boundary Contract Graph](boundary-contract-graph.md)
- [Structural IA Lineage](structural-ia-lineage.md)
