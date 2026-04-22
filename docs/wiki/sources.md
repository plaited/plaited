# Sources

> Status: provenance index for this wiki.

## Local Runtime Sources

- `docs/wiki/architecture.md` defines the top-level framework shape.
- `docs/wiki/actor-runtime.md` documents current actor runtime and policy ledger
  behavior.
- `docs/wiki/agent-loop.md` documents minimal core plus module-composed
  orchestration.
- `docs/wiki/local-inference-bridge.md` documents the target same-machine
  neural runtime bridge decision.
- `skills/plaited-runtime/` is the compact runtime doctrine for module, MSS,
  projection, and actor-boundary work.
- `src/modules/projection-boundary-actor.ts` and
  `src/modules/module-program-admission.ts` are current executable sources for
  projection policy and module program admission.
- `src/behavioral/actor-policy-ledger.ts` is the current executable source for
  actor policy replay.

## Historical Lineage

- Rachel Jaffe, "Past the Internet: The Emergence of the Modnet", February 3,
  2020.
- Rachel Jaffe, "Modnet Design Standards", February 3, 2020.
- Rachel Jaffe, "Current Frameworks of Information Architecture", July 11,
  2019.
- Rachel Jaffe, "Development of a new language for Information Architecture",
  July 18, 2019.
- Rachel Jaffe, "A unified language for the design of information systems",
  June 11, 2019.

The repo previously carried these materials in `docs/Modnet.md` and
`docs/Structural-IA.md` on `main`. They are treated here as conceptual lineage,
not as current implementation contracts.

## Wiki Method

This wiki follows the local-repo version of the LLM-maintained wiki pattern:
small linked pages, explicit source notes, and a maintenance log. See Andrej
Karpathy's gist on LLM-written codebase wikis for the external inspiration.
