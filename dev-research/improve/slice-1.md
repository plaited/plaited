# Slice 1: Extract the Improvement Protocol Boundary

## Target

Identify and begin separating the model-agnostic improvement protocol from the
provider-specific adapter and judge layer in the current dev autoresearch stack.

## Scope

- `src/improve/`
- `scripts/dev-autoresearch.ts`
- `scripts/`

## Required

- Preserve current bounded autoresearch behavior.
- Keep Claude/Codex-specific code out of shared framework surfaces.
- Clarify which attempt/provenance/program-slice responsibilities are generic.
- Do not force a full migration in one slice.

## Preserve

- current bounded autoresearch semantics remain intact
- provider-specific adapters and judges remain outside the shared framework surface
- provenance and experiment history stay explicit
- this lane remains distinct from runtime-taxonomy and native-model work

## Acceptance Criteria

- The code and docs make the boundary between generic improvement substrate and
  provider-specific bindings more explicit.
- The direction supports later reuse by:
  - skills evaluation
  - module improvement
  - native-model improvement
- The work does not collapse developer calibration infrastructure into the
  runtime-taxonomy or native-model lanes.

## Notes

This slice is about the architectural boundary first.
Keep it bounded and avoid a full rewrite of the current harness.
