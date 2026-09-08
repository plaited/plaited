# tasks/

Harbor task directories for the autoresearch eval loop. Each task asks a
coding agent (running in a Daytona sandbox) to author and install an
AgentSkills-compliant skill — a `SKILL.md` plus a JSON-in/JSON-out CLI script —
at a conventional discovery location (`.agents/skills/<name>/`). A
deterministic verifier recomputes truth from fixtures (no golden repo, no
oracle) and writes a fractional `/logs/verifier/reward.json`.

These tasks are challenge content only — nothing here ships with the package
or is consumed as a plugin.

| Task | Skill the agent must build |
|------|---------------------------|
| `build-git-context-skill/` | `git-context` — status/history/worktrees/context CLI over git |
| `build-typescript-lsp-skill/` | `typescript-lsp` — documentSymbol/hover/discover CLI over the TypeScript 7 native API |

## Layout (per task)

```
task/
├── task.toml        # [environment] os="linux", no-network baseline
├── instruction.md   # agent-facing contract (points at SPEC.md)
├── environment/
│   ├── Dockerfile   # Bun base; bakes in SPEC.md + fixtures
│   ├── SPEC.md      # full skill + CLI contract (self-contained)
│   └── fixtures/    # deterministic fixture builders / files
└── tests/
    └── test.sh      # verifier: layer 1 (skill validity gate) + layer 2 (CLI accuracy)
```

## Running

```bash
# Local docker (note: docker cannot enforce no-network; images are hermetic by
# construction, so run with the network mode relaxed or use Daytona)
harbor run -p tasks/build-git-context-skill --env docker -a <agent> -k 1

# Daytona (enforces the no-network baseline; per-trial fresh sandboxes)
harbor run -p tasks/build-typescript-lsp-skill --env daytona -a <agent> -k 2 -n 2
```

## Reward shape

```json
{
  "reward": 0.75,
  "skill_valid": 1,
  "cli_accuracy": 0.75,
  "checks_passed": 9,
  "checks_total": 12,
  "installed_project_level": 1,
  "installed_user_level": 0
}
```

`skill_valid = 0` (skill missing from `.agents/skills/<name>/` or malformed)
zeroes the run; otherwise `reward = cli_accuracy = checks_passed / checks_total`.

Note: Harbor's default job metric is `Mean` over all keys in `reward.json`;
consume the `reward` key (or `cli_accuracy`) rather than the aggregate.
