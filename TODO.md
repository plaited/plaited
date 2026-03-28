# TODO

- Replace the Pi-driven `default-hypergraph` seed generation flow with Plaited-native tooling.
  Keep Pi-specific orchestration in `scripts/` until Plaited can own:
  source chunking, seed generation, encoded corpus generation, validation,
  and behavioral-factory compilation.
- Harden fanout isolation so worktree attempts cannot write back into the
  main repo during research runs.
- Align `src/improve` and `scripts/autoresearch-runner.ts` with
  `dev-research/evolutionary-agent/program.md`.
  Add explicit support for:
  agent-package mutation surfaces, candidate lineage, long-horizon trajectory
  capture, retrieval/search quality dimensions, and promotion-quality training
  data extraction from accepted attempts.
- Reposition `trial-runner` and `trial-adapters` as public `improve` utilities,
  not the center of Plaited's internal self-improvement loop.
- Fold the still-useful parts of `skills/training-pipeline` into
  `dev-research/evolutionary-agent/program.md` and adjacent `src/improve`
  documentation, then remove the stale standalone skill if nothing unique remains.
