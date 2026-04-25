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

## External Paper Notes

- Ruixiang Zhang, Richard He Bai, Huangjie Zheng, Navdeep Jaitly, Ronan
  Collobert, Yizhe Zhang, "Embarrassingly Simple Self-Distillation Improves
  Code Generation" (arXiv:2604.01193, April 1, 2026). Added as
  `docs/wiki/embarrassingly-simple-self-distillation.md`.
- Capture method for the note above: You.com `contents` endpoint against
  `https://arxiv.org/html/2604.01193v1` and `https://arxiv.org/abs/2604.01193`
  on April 25, 2026.
- Chroma, "Chroma Context-1: Training a Self-Editing Search Agent"
  (`https://www.trychroma.com/research/context-1`). Added as
  `docs/wiki/chroma-context-1.md`.
- Capture method for the note above: You.com `contents` (metadata capture) plus
  You.com `research` (source-cited synthesis) on April 25, 2026.

## Wiki Method

This wiki follows the local-repo version of the LLM-maintained wiki pattern:
small linked pages, explicit source notes, and a maintenance log. See Andrej
Karpathy's gist on LLM-written codebase wikis for the external inspiration.
