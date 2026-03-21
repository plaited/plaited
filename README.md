![Plaited sovereign agent node framework: sovereign nodes, A2A modnets, generative UI, and behavioral runtime provenance](assets/banner.svg)

**Sovereign agent nodes first. Framework details second.**

[![Build/Tests](https://github.com/plaited/plaited/actions/workflows/ci.yml/badge.svg)](https://github.com/plaited/plaited/actions/workflows/ci.yml)

---

Plaited is a framework for **sovereign agent nodes**.

Each node is owned by one user or organization, keeps its modules internal, records its own memory and provenance, and collaborates with other nodes through A2A instead of a central platform. The long-term goal is a **modnet**: a network of sovereign nodes exchanging tasks, services, artifacts, and controlled data without giving up local authority.

Under that model, Plaited provides the technical substrate:
- a BP-first runtime
- an agent loop with governance and evaluation seams
- generative UI primitives
- A2A and modnet building blocks
- git + `.memory/`-based provenance
- dev autoresearch infrastructure for improving the framework itself

## Layer 1: What Plaited Is Building

### Sovereign Nodes

A Plaited node is:
- one agent serving one user or organization
- one local workspace with its own constitution, memory, and modules
- one treaty boundary where all external coordination goes through A2A and PM mediation

Modules stay internal to the node. Other nodes do not directly access them. They request services, receive artifacts, or negotiate bounded work through A2A.

### Modnets

A modnet is a network of sovereign nodes:
- nodes communicate peer-to-peer
- A2A is the external exchange boundary
- git bundles and other artifacts can later be exchanged through governed A2A flows
- enterprise and shared-service nodes are first-class future targets, not special cases

### Native Model Direction

The framework and harness are being built first.

After that, a separate native-model lane focuses on making Falcon or another Plaited-native model strong at:
- generating modules end-to-end
- generating UI through Plaited's controller/generative UI model
- operating inside Plaited's BP/PM/MSS ontology

### TODO: Native Model PoC Validation (Phase 1)

**Goal:** Prove autoresearch + native model distillation works before fundraising.

**Experiment:** 3K trials on H100 cloud, 48-hour validation.

---

## Step 1: Cloud Infrastructure Setup

**1a. Sign up for Thunder Compute H100**
- Go to https://www.thundercompute.com/
- Create account, add payment method
- Request H100 instance (spot pricing, ~$1.38/hr)
- Note: API key and endpoint URL

**1b. Set environment variables**
```bash
export THUNDER_COMPUTE_API_KEY="your-api-key"
export THUNDER_COMPUTE_ENDPOINT="https://api.thundercompute.com/v1"
export THUNDER_COMPUTE_MODEL="meta-llama/Llama-3.1-70B"  # or Falcon equiv
```

---

## Step 2: Cloud Adapter (✓ Complete)

**Status:** `scripts/thunder-compute-adapter.ts` created

Implements cloud-based inference for Thunder Compute H100 with:
- HTTP client for Thunder Compute REST API
- Batch queue (8-16 parallel requests) for throughput optimization
- Exponential backoff retry logic (3 attempts, max)
- Token usage tracking for cost measurement
- Standard Adapter interface (AdapterInput/AdapterResult)
- Timeout handling and graceful error recovery

**What you need to do:**
1. Sign up for Thunder Compute account at https://www.thundercompute.com/
2. Get API key and endpoint URL
3. Set environment variables (see Step 1b)
4. Run the validation experiment (see Step 3)

---

## Step 3: Run Validation Experiment

**3a. Dry run (no charges)**
```bash
bun run research:overnight -- ./dev-research/native-model/slice-1.md \
  --adapter ./scripts/thunder-compute-adapter.ts \
  --judge \
  --dry-run \
  --max-attempts 3
```

**3b. Full run (48 hours, $1,178)**
```bash
# Monitor Thunder Compute dashboard in parallel
bun run research:overnight -- ./dev-research/native-model/slice-1.md \
  --adapter ./scripts/thunder-compute-adapter.ts \
  --judge \
  --max-attempts 30
```

**3c. Collect results**
```bash
# After completion:
# - Extract good outputs (judge score > 0.85) → /tmp/good-outputs.jsonl
# - Log cost breakdown ($$$)
# - Compare to baseline
```

---

## Step 4: Fine-tune & Evaluate

**4a. Fine-tune Falcon on collected data**
```bash
# Use collected outputs to fine-tune
bun scripts/falcon-finetune.ts \
  --data /tmp/good-outputs.jsonl \
  --method qlora \
  --model falcon-7b
```

**4b. Evaluate**
```bash
# Test baseline vs fine-tuned on benchmark
bun scripts/eval-native-model.ts \
  --baseline-model falcon-7b \
  --finetuned-model falcon-7b-finetuned \
  --test-set ./dev-research/native-model/evals/test-cases.jsonl
```

---

**Expected Outcome:**
- ✓ Generation works (H100 produces valid modules)
- ✓ Judging works (Sonnet identifies quality)
- ✓ Distillation works (fine-tuned model improves)
- ✓ Unit economics clear (cost per good output)

**Cost:** $1,178 (H100 + APIs)
**Timeline:** 48 hours wall-clock
**Success Criteria:** Measurable improvement on test set, <$5 cost per quality output

**Next Step:** If validation succeeds, scale to 8K trials on MSI EdgeXpert ($6,900) for investor-ready model.

## Layer 2: How Plaited Works

### Behavioral Programming First

Plaited's core runtime is behavioral-program shaped:
- symbolic constraints and coordination are expressed as behavioral programs
- the neural model proposes work
- the symbolic layer governs, blocks, coordinates, and records it

This keeps:
- safety logic stable across model changes
- orchestration observable
- provenance and distillation tractable

### Runtime Taxonomy

Current runtime work is converging on:
- `MSS object` — structural description only
- `artifact` — concrete implementation asset
- `behavioral actor` — BP runtime edge around an artifact
- `sub-agent` — isolated behavioral actor with fresh context/runtime
- `team` — coordinated set of sub-agents
- `PM` — sovereign coordinator and treaty authority

### Agent Loop

The agent loop is a framework primitive, not a black box product feature. It provides:
- gating
- simulation/evaluation seams
- governance and constitution enforcement
- memory and snapshot handling
- local and A2A execution surfaces

Exports today include:
- [agent.ts](/Users/eirby/Workspace/plaited/src/agent.ts)
- [behavioral.ts](/Users/eirby/Workspace/plaited/src/behavioral.ts)
- [modnet.ts](/Users/eirby/Workspace/plaited/src/modnet.ts)
- [runtime.ts](/Users/eirby/Workspace/plaited/src/runtime.ts)
- [ui.ts](/Users/eirby/Workspace/plaited/src/ui.ts)

### Generative UI

Generative UI remains an important capability, but it now sits inside the broader node architecture.

The intent is not “AI-generated screens” in isolation. It is:
- UI generated by sovereign nodes
- shaped by local modules and memory
- constrained by behavioral programs and constitutions
- delivered through Plaited's controller/generative UI runtime

### Provenance and Memory

Plaited separates two uses of memory:

- this framework repo's top-level `.memory/`
  - local dev/eval/autoresearch traces
  - ignored from git
- future node/module `.memory/`
  - part of the node's operational record
  - expected to be committed as provenance

Git is not just deployment plumbing here. It is part of the accountability model.

## Repository Map

- [src/](/Users/eirby/Workspace/plaited/src/) — framework code that ships with the node
- [scripts/](/Users/eirby/Workspace/plaited/scripts/) — eval, adapters, graders, dev autoresearch infrastructure
- [skills/](/Users/eirby/Workspace/plaited/skills/) — implementation patterns, references, operational tooling
- [docs/](/Users/eirby/Workspace/plaited/docs/) — design rationale and active architecture docs
- [dev-research/](/Users/eirby/Workspace/plaited/dev-research/) — bounded research programs for improving Plaited itself

Current research lanes:
- [program.md](/Users/eirby/Workspace/plaited/dev-research/runtime-taxonomy/program.md) — framework/runtime/autoresearch lane
- [program.md](/Users/eirby/Workspace/plaited/dev-research/skills/program.md) — skills/tooling lane
- [program.md](/Users/eirby/Workspace/plaited/dev-research/improve/program.md) — generic improvement substrate lane
- [program.md](/Users/eirby/Workspace/plaited/dev-research/native-model/program.md) — native-model/Falcon lane
- [program.md](/Users/eirby/Workspace/plaited/dev-research/modnet/program.md) — inter-node/modnet lane

## Development

### Requirements

- [Bun](https://bun.sh/) `>= v1.2.9`
- `git`
- for judged autoresearch:
  - Anthropic access
  - Varlock + 1Password setup via [`.env.schema`](/Users/eirby/Workspace/plaited/.env.schema)

### Useful Commands

```bash
# Typecheck
bun --bun tsc --noEmit

# Full test suite
bun test src/ skills/ scripts/

# One bounded research run
bun run research -- ./dev-research/runtime-taxonomy/slice-1.md --max-attempts 1

# Longer unattended batch
bun run research:overnight -- ./dev-research/runtime-taxonomy/slice-2.md
```

### Native-Model Commands

```bash
# Run the current bounded native-model validation batch against an adapter
bun run native-model:validate -- --adapter ./scripts/codex-cli-adapter.ts

# Prepare a trainer-friendly SFT dataset + manifest from curated outputs
bun run native-model:train

# Launch the MLX LoRA backend through a Bun wrapper
bun run native-model:train:mlx -- --run

# Start the local Falcon MLX inference server
bun run falcon:mlx
```

What each command does:

- `bun run native-model:validate -- --adapter ...`
  - runs the current native-model eval prompt batch through the trial layer
  - writes `run.json`, `results.jsonl`, `summary.md`, and `summary.json`
  - is the command to use when checking validation pass rate, training eligibility, and trajectory richness

- `bun run native-model:train`
  - converts `dev-research/native-model/evals/curated-good-outputs.jsonl` into a trainer-friendly SFT dataset
  - writes a manifest and output paths for the first local tuning run
  - does not start training by itself unless a trainer backend is configured

- `bun run falcon:mlx`
  - starts the local MLX inference server for Falcon H1R on Apple Silicon
  - is for local inference/eval loops, not weight updates

- `bun run native-model:train:mlx -- ...`
  - prepares the SFT dataset and launches the MLX LoRA/SFT backend through a Bun wrapper
  - keeps Python as the training implementation, but Bun as the operator surface
  - defaults to a timestamped run under `dev-research/native-model/training/runs/`
  - forwards flags to:
    - [train_mlx_lora.py](/Users/eirby/Workspace/plaited/dev-research/native-model/training/train_mlx_lora.py)

The MLX LoRA/SFT backend currently lives under:
- [training](/Users/eirby/Workspace/plaited/dev-research/native-model/training)

The first real local tuning run can now be launched from the repo root:

```bash
bun run native-model:train:mlx -- --run
```

Use `--output-dir` when you want a stable run path:

```bash
bun run native-model:train:mlx -- --output-dir ./dev-research/native-model/training/runs/bootstrap-mlx --run
```

### Agent-Facing CLI

The repo ships an agent-facing CLI toolbox:
- `plaited read-file`
- `plaited write-file`
- `plaited edit-file`
- `plaited list-files`
- `plaited bash`
- `plaited validate-skill`
- `plaited validate-thread`
- `plaited ingest-goal`
- `plaited ingest-skill`
- `plaited ingest-rules`
- `plaited discover-skills`
- `plaited typescript-lsp`

See:
- [cli.ts](/Users/eirby/Workspace/plaited/src/cli.ts)

## Read Next

- [ARCHITECTURE.md](/Users/eirby/Workspace/plaited/docs/ARCHITECTURE.md)
- [MODNET-IMPLEMENTATION.md](/Users/eirby/Workspace/plaited/docs/MODNET-IMPLEMENTATION.md)
- [HYPERGRAPH-MEMORY.md](/Users/eirby/Workspace/plaited/docs/HYPERGRAPH-MEMORY.md)
- [CONSTITUTION.md](/Users/eirby/Workspace/plaited/docs/CONSTITUTION.md)

## License

ISC
