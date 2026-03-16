# Current Work

## Active

- **Proactive skill calibration** — autoresearch loop on 5 proactive eval prompts (`bun run research`)
- **SFT trajectory collection** — Prompt 16, running via `bun run research:overnight`

## Scripts

| Script | What it does |
|---|---|
| `bun run prompt` | Opus session with remote control for implementation prompts |
| `bun run research` | Sonnet calibration loop (3 experiments, remote control) |
| `bun run research:overnight` | Sonnet calibration loop (50 experiments, remote control) |

## Future Work

See `PROMPTS.md` § Future Work and `docs/AUTO-RESEARCH.md` for full details.

- **Enterprise genome** — PM node seed generation from calibrated skills
- **Multi-agent git coordination via A2A** — AgentHub concepts built natively
- **Module worktree experiments** — per-module autoresearch
- **Project isolation orchestrator** — subprocess spawning, IPC bridge
- **Web search for MSS prompt generation** — expand prompts.jsonl via grounded research
- **Session rollback/branching UX**
- **Mid-task steering**
