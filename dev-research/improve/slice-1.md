# Slice 1: Extract the Improvement Protocol Boundary

## Target

Identify and begin separating the model-agnostic improvement protocol from the
provider-specific adapter and judge layer in the current dev autoresearch stack.

## Scope

- `src/improve/`
- `scripts/dev-autoresearch.ts`
- `scripts/codex-cli-adapter.ts`
- `scripts/claude-code-judge.ts`
- `scripts/tests/dev-autoresearch.spec.ts`

## Required

- Preserve current bounded autoresearch behavior.
- Keep Claude/Codex-specific code out of shared framework surfaces.
- Clarify which attempt/provenance/program-slice responsibilities are generic.
- Make the generic/provider-specific boundary explicit in code or docs.
- Do not force a full migration in one slice.

## Preserve

- current bounded autoresearch semantics remain intact
- provider-specific adapters and judges remain outside the shared framework surface
- provenance and experiment history stay explicit
- this lane remains distinct from runtime-taxonomy and native-model work

## Avoid

- full-harness rewrites in one slice
- moving provider-specific bindings into `src/`
- collapsing this lane into runtime-taxonomy or native-model policy

## Acceptance Criteria

- The code and docs make the boundary between generic improvement substrate and
  provider-specific bindings more explicit.
- The slice identifies a concrete extraction boundary rather than leaving the
  separation entirely conceptual.
- The direction supports later reuse by:
  - skills evaluation
  - module improvement
  - native-model improvement
- The work does not collapse developer calibration infrastructure into the
  runtime-taxonomy or native-model lanes.

## Notes

This slice is about the architectural boundary first.
Keep it bounded and avoid a full rewrite of the current harness.
