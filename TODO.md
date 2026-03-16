# Current Work

## Active

- **SFT trajectory collection** — Prompt 16, running via `bun run research:overnight` (25 prompts, k=10)

## Next

- **Prompt 17: Node generation eval** — 6 full personal-agent prompts + node-grader + node-generation skill (plaited genome)
- **Node calibration** — autoresearch loop on node-generation prompts
- **Prompt 18: Client-pushed sensors** — WebSocket sensor_input → sensor_delta, ClientSensorFactory type, mobile sensor patterns
- **Node + proactive trajectory collection** — add to SFT data, then train

## Scripts

| Script | What it does |
|---|---|
| `bun run prompt` | Opus session with remote control for implementation prompts |
| `bun run research` | Sonnet calibration loop (3 experiments, remote control) |
| `bun run research:overnight` | Sonnet calibration loop (50 experiments, remote control) |

## Future Work

See `PROMPTS.md` § Future Work and `docs/AUTO-RESEARCH.md` for full details.
