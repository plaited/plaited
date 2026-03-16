# Current Work: Final Phase

Framework refinement via frontier agent evaluation. See PROMPTS.md for detailed worktree prompts.

## Implementation Status

| Layer | Status |
|-------|--------|
| **BP Engine** (`src/behavioral/`) | Complete |
| **UI** (`src/ui/`) | Complete |
| **Server** (`src/server/`) | Complete (replay buffer, CSP, validateSession) |
| **Agent Loop** (`src/agent/`) | Complete (createAgentLoop, all handlers, tiered context, transport executors) |
| **Governance** | Complete (branded factories, MAC rules, goal persistence) |
| **A2A Protocol** (`src/a2a/`) | Complete (HTTP + WebSocket, push notifications, known-peers) |
| **Training Pipeline** | Complete (scoring, grading, bThread trials) |
| **Hypergraph Memory** | Complete (snapshot writer, ingestion CLI, session lifecycle) |
| **Tools** | Complete (truncation, grep, scan-assisted edit, binary detection) |
| **ACP Adapter** | Complete (debug viewport, multi-node, A2A observation) |
| **Skills** | 27 skills (framework seeds, dev tools, eval, search) |
| **Docs** | Slimmed (12 files, implementation patterns moved to skills) |

## Remaining Work (PROMPTS.md Phases 0-4)

### Phase 0: Cleanup
- [ ] Fix .bthread-grader-* temp dir cleanup (40+ orphaned)
- [ ] Remove @plaited/agent-eval-harness and @plaited/development-skills references (5 files)

### Phase 1: Framework Infrastructure
- [ ] Module-per-repo workspace utilities (`src/modnet/workspace.ts`)
- [ ] Server + agent integration (`createNode` factory)
- [ ] Model implementations (OpenAI-compat for Ollama/vLLM, Anthropic, Gemini)

### Phase 2: MSS Skills + Eval Infrastructure
- [ ] MSS vocabulary skill (distill Structural-IA + Modnet.md)
- [ ] Enrich modnet-node skill (97 → 250+ lines)
- [ ] Trial adapters (claude-code, codex, gemini) + eval result persistence

### Phase 3: Module Generation Eval
- [ ] 20 module generation prompts (6 domains, MiniAppBench-adapted, Bluesky flagship)
- [ ] Module grader (Intention × Static × Dynamic scoring)
- [ ] Run eval cycle → calibrate skills → iterate

### Phase 4: Distillation Data Collection
- [ ] Collect SFT trajectories from frontier agents
- [ ] Multi-agent diversity (Claude, Gemini, Codex)
- [ ] Quality gate with withStatisticalVerification

## Eval Pipeline Model Mix + Cost Estimates

| Role | What It Does | Recommended Model | Cost/Month |
|---|---|---|---|
| **Generation** | Generates module code from prompts | Claude Opus 4.6 or Gemini 2.5 Pro | $50-200 |
| **Inline Grading** | Tests, structure checks, pass/fail | Codex (fast) or local Qwen3-8B | $10-30 or $0 |
| **Meta-Verification** | Grader reliability, confidence | Gemini 2.5 Flash or Haiku 4.5 | $5-15 |
| **Training Target** | Model being distilled | Falcon-H1R 7B (local) | $0 (sunk cost) |

### Cloud Deployment Options

| Platform | Cost/hr | Best For |
|---|---|---|
| OpenCode + llama.cpp | $0.50-2 | Full control, cheapest sustained |
| OpenCode + vLLM | $1-4 (A100) | High throughput batched inference |
| RunPod | $0.74 (A100 80GB) | Burst capacity, no setup |
| Modal | $0.000025/s (A100) | Serverless, zero idle cost |
| Together AI / Fireworks | $0.20-1.00/M tokens | No infra, good for prototyping |

### Estimated Costs by Phase

| Phase | What | Est. Cost |
|---|---|---|
| Development (iterating skills + prompts) | 50-100 trial runs, Claude + Codex + Gemini Flash | $100-300/mo |
| Distillation (collecting trajectories) | Claude + Gemini Pro + RunPod fine-tune | $500-1000 total |
| Production (ongoing improvement) | Local Falcon-H1R + Codex API for grading | $30-50/mo |

## Not Blocking Current Work (Deferred)

- Project isolation orchestrator (subprocess spawning, IPC bridge)
- Proactive mode tool definition (`set_heartbeat`)
- Push notification routing for proactive results
- Session rollback/branching UX
- Mid-task steering (user intervention points)
- Enterprise genome (PM node seed generation)
- ACP-over-HTTP (SSH + editor remote handles remote access)
