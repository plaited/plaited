# MSI Operator Notes

## Purpose

This is the practical operator note for running the native-model lane on the
MSI target:

- NVIDIA DGX Spark OS
- Network Appliance Mode
- reached remotely from the Mac over Tailscale

This document is intentionally about operations, not model strategy.

## Access Model

Assume the MSI is a remote training appliance, not a desktop workstation.

Primary access path:
- Mac -> Tailscale -> SSH -> MSI shell

Primary editing path:
- Zed on the Mac against the remote workspace

Fallback observation path:
- Android phone over SSH using ServerAuditor / Termius-style mobile terminal

That means all long-running work should be safe to reconnect to without
depending on a persistent local GUI session.

## Session Model

Use `cmux` as the default terminal/session layer.

Recommended session names:
- `train`
- `serve`
- `eval`
- `ops`

Recommended window split:
- one pane for the active command
- one pane tailing logs
- one pane for quick status commands

Do not rely on a single foreground shell for anything expensive.

## Core Commands

Examples only; adapt hostnames and paths to your actual setup.

```bash
# attach to the MSI from the Mac
ssh <tailscale-host-or-ip>

# create or attach the main cmux session
cmux new -s train
cmux attach -t train

# run validation from the repo root
bun run native-model:validate -- --adapter ./scripts/falcon-h1r-mlx-adapter.ts

# compare a tuned run against baseline
bun run native-model:compare -- \
  --baseline ./dev-research/native-model/evals/runs/<baseline-run> \
  --candidate ./dev-research/native-model/evals/runs/<candidate-run>

# run the shared orchestrator for native-model fanout
bun run program:run -- ./dev-research/native-model/slice-4.md \
  --lane native-model \
  --pattern fanout \
  --agents 3 \
  --model <model-id> \
  --max-seq-length <n> \
  --num-layers <n> \
  --iters <n>
```

## Port Discipline

Because the MSI runs in Network Appliance Mode, document ports explicitly.

Minimum rule:
- one serving port per active model/eval service
- one output directory per run
- do not reuse ports implicitly across parallel candidate runs

Track at least:
- Falcon serving port
- helper-model serving port, if any
- eval/control service ports

When native-model fanout becomes parallel on the MSI:
- assign distinct ports per candidate
- assign distinct run/output directories per candidate
- keep the mapping visible in logs and run manifests

## Logging

Prefer simple log locations that are easy to inspect from both Mac and phone.

Recommended pattern:
- write logs under the run directory when possible
- otherwise use a named `logs/` directory in the repo or host workspace

Minimum operator expectation:
- you can answer “what is running?”
- you can answer “where is the latest log?”
- you can answer “which port belongs to which run?”

## Mobile Observation

Phone access is for observation and lightweight intervention, not deep editing.

Design around that:
- short status commands
- stable `cmux` session names
- obvious log paths
- avoid interactive flows that require a large editor UI

Useful mobile-safe checks:

```bash
git status --short
git branch --show-current
ls dev-research/native-model/evals/runs | tail
tail -n 40 <log-file>
```

## Bring-Up Checklist

1. Confirm Tailscale connectivity from the Mac.
2. Confirm SSH access to the MSI.
3. Start a named `cmux` session.
4. Verify repo checkout and branch.
5. Verify Bun/Python/trainer environment.
6. Verify model-serving port plan.
7. Run one bounded validation or compare command first.
8. Only then start longer training or fanout jobs.

## Non-Goals

This document does not replace:
- [program.md](/Users/eirby/Workspace/plaited/dev-research/native-model/program.md)
- [README.md](/Users/eirby/Workspace/plaited/README.md)
- [training/README.md](/Users/eirby/Workspace/plaited/dev-research/native-model/training/README.md)

Those documents define strategy and lane boundaries.
This one only defines the operator surface for the MSI environment.
