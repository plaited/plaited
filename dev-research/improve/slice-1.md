# Slice 1: Extract the Improvement Protocol Boundary

## Target

Identify and begin separating the model-agnostic improvement protocol from the
provider-specific adapter and judge layer in the current dev autoresearch stack.

## Scope

- `src/improve/`
- `scripts/dev-autoresearch.ts`
- `scripts/`

## Requirements

- Preserve current bounded autoresearch behavior.
- Keep Claude/Codex-specific code out of shared framework surfaces.
- Clarify which attempt/provenance/program-slice responsibilities are generic.
- Do not force a full migration in one slice.

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
