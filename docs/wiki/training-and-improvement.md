# Training And Improvement

> Status
>
> - Implemented now: Plaited ships behavioral/runtime, eval, and CLI tooling that can support structured experimentation.
> - Target direction: doctrine-aligned improvement where boundary contracts, identity evidence, and execution authority outcomes become first-class training/evaluation artifacts.

## Improvement Strategy

### Implemented now

- Tooling supports evaluation and trace-oriented workflows.
- No source-backed autonomous doctrine migration loop enforces dual-lane/BCG correctness by default.

### Target direction

- Improve in two phases:
  1. stabilize symbolic doctrine (dual-lane + BCG + auth split)
  2. adapt model behavior to that stable doctrine

## Doctrine-Aligned Artifact Focus

### Implemented now

- Existing runtime traces and tests provide baseline evidence.

### Target direction

Use structured artifacts such as:

- boundary contract drafts and approvals
- entitlement/provenance policy outcomes
- identity-plane verification outcomes
- execution-plane grant/denial outcomes
- capability-token scope/expiry/delegation failures
- projection-policy decisions

## Identity Plane vs Execution Plane in Evaluation

### Implemented now

- The split is doctrine guidance, not a globally enforced eval contract.

### Target direction

- Evaluate identity-plane correctness separately from execution-plane authority.
- Treat false trust acceptance and false authority issuance as distinct failure classes.
- Track cross-plane regressions explicitly.

## End-to-End Improvement Flow

### Implemented now

1. Use local tooling to run eval/validation workflows.
2. Inspect outputs and iterate manually.

### Target direction

1. Generate or curate request sets with identity and entitlement variance.
2. Validate identity-plane outcomes (verification/revocation/freshness).
3. Validate execution-plane outcomes (grant/token/scope enforcement).
4. Score projection-policy correctness (local UI only, exchange contract intact).
5. Promote doctrine-consistent behavior into default policies/model prompts.

## Threat Model Notes

### Implemented now

- Doctrine-specific failure taxonomy is not fully encoded in shared tooling.

### Target direction

- Detect trust-authority conflation (claims accepted as direct authority).
- Detect over-broad token grants and stale-claim acceptance.
- Detect provenance/watermark omission for premium content flows.

## Example Evaluation Contract

```yaml
contractId: eval.boundary.creator.video.v1
contractType: evaluation
resource: asset://creator/video/episode-3
checks:
  - identityPlane.verification == pass
  - executionPlane.grant == deny_when_revoked
  - executionPlane.tokenScope == read_stream_only
  - projectionPolicy.localOnly == true
```

## Premium Creator Distribution Example

Evaluation should cover premium text/audio/video/game scenarios with:

- valid subscriber claim
- revoked subscriber claim
- delegated request attempt
- expired token replay attempt
- provenance/watermark compliance checks

## Related

- [Architecture](architecture.md)
- [Boundary Contract Graph](boundary-contract-graph.md)
- [Node-To-Node Auth](node-to-node-auth.md)
- [Sources](sources.md)
