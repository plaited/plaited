# TODO

- Replace the Pi-driven `default-hypergraph` seed generation flow with Plaited-native tooling.
  Keep Pi-specific orchestration in `scripts/` until Plaited can own:
  source chunking, seed generation, encoded corpus generation, validation,
  and behavioral-factory compilation.
- Harden fanout isolation so worktree attempts cannot write back into the
  main repo during research runs.
