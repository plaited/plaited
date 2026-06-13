---
name: train-neuro-symbolic-agent
description: >
  Implementation guide for training Plaited's neuro-symbolic ICL analyst. A
  fine-tuned small model generates structured in-context learning (ICL)
  instructions for a larger frozen executor. Training data is extracted from
  topic snapshot JSONLs via metadata-carried ICL contracts. The small model
  accesses external context through MCP search providers (installed via
  add-remote-mcp). Covers training pipeline, verifier-filtered dataset
  extraction, and ICL wire between analyst and executor.
license: ISC
compatibility: Requires bun, onbraid CLI, inference worker with model endpoint, Unsloth for SFT
---

# Train Neuro-Symbolic Agent

Use this skill when implementing the training pipeline for Plaited's
ICL analyst. This is a hands-on implementation guide. Every section maps
to runnable code or a concrete configuration.

## Architecture: Analyst / Executor Dual-Model

We run **two models** through the same inference worker. The inference worker
connects to a local vLLM endpoint (e.g. `openresponses.org`) that serves both
models. The worker is model-agnostic — the model name field selects which
weights to load.

| Role | Model | Size | Purpose |
|------|-------|------|---------|
| **Analyst** | (fine-tuned small model) | Sub-2B (e.g. Qwen2.5-Coder-1.5B, BitNet b1.58) | Reviews Plaited patterns and objectives; generates structured ICL instructions for the executor |
| **Executor** | (frozen large model) | Large (e.g. 26B MoE, dense 30B+) | Receives ICL instructions from analyst; generates behavioral specs, code, and tool calls |

Both models are accessible via OpenAI-compatible HTTP APIs through the same
inference worker. The Plaited agent calls the **analyst first** to produce
instructions, then injects those instructions into a prompt for the **executor**.

### Why this architecture?

- **Train tiny, serve huge**: The sub-2B analyst is fine-tuned. The large
  executor is frozen — no training, no LoRA, no GRPO. ICL carries the
  analyst's knowledge to the executor via the prompt.
- **One inference worker**: Both models share the same worker and endpoint.
  The `model` field distinguishes them.
- **Analyst evolves without executor downtime**: Retrain the sub-2B, swap
  in the new weights, and the executor immediately sees the new ICL style.
- **ICL = zero-weight indirection**: The IBM definition of
  [in-context learning](https://www.ibm.com/think/topics/in-context-learning)
  applies directly — the executor "learns" from examples and instructions
  embedded in its prompt, not from parameter updates.

## Stage 0: SSD Pre-Training (New Default First Step)

Before any verifier-filtered training, we apply **Simple Self-Distillation
(SSD)** (arXiv:2604.01193v1) to the analyst model. SSD is embarrassingly
simple: sample from the model at temperature `T_train` with truncation,
then fine-tune on those raw, unverified samples via standard SFT.

No verifier, no teacher, no RL, no correctness filtering, no executor
involved. Only the analyst model and a set of problem prompts.

### Why SSD first

The paper shows SSD resolves a **precision-exploration conflict** in LLM
decoding by reshaping token distributions context-dependently:
- At **lock** positions (syntax, constraints, structure), SSD suppresses
  distractor tails that hurt precision
- At **fork** positions (multiple viable continuations), SSD preserves
  useful diversity for exploration

For our analyst, this means:
- **Better baseline reasoning**: the analyst produces more reliable ICL
  instructions from the start
- **Better syntax compliance**: the ICLContract JSON schema is more likely
  to be structurally valid
- **Better instruction adherence**: the analyst stays on task
- **Cleaner foundation for Code2LoRA**: repo-specific adapters build on
  a model whose locks are already sharp and whose forks are already
  well-calibrated

Critically, SSD requires **no labeled data** — just prompts and the model
itself. The dataset can be drawn from Plaited agent history, competitive
programming seeds, or general coding prompts.

### SSD procedure

```
1. Collect ~10K unique prompts from Plaited agent history or seed datasets

2. For each prompt, sample one solution from the analyst model:
     y ~ Decode(T_train, top-k, top-p)[p_θ(·|x)]

   Recommended hyperparameters (from paper, validated on 4B–30B models):
     T_train = 2.0
     top-k = 10
     N = 1  (single sample per prompt suffices)

3. No filtering — keep all raw outputs, even gibberish. The paper shows
   SSD improves even when 62% of outputs contain no extractable code.

4. Fine-tune with standard SFT (cross-entropy) on the resulting pairs:
     L(θ) = -E_{(x,y)~D_SSD} Σ log p_θ(y_t | x, y_<t)

5. At inference, use a different decoding temperature T_eval:
     The paper finds T_eff = T_train · T_eval ≈ 1.2 is a good starting point.
     For T_train=2.0, this gives T_eval ≈ 0.6.
```

### SSD curriculum placement

```
New full curriculum:

  SSD stage  →  Stage 0 (bootstrap)  →  Stage 1-5 (verifier-filtered)
    (no verifier)   (hand-crafted ICL)    (passes L1–L5 chain)
```

The SSD stage produces a stronger base model at zero labeling cost. Stage 0
(bootstrap with hand-crafted ICL instructions) then starts from a model that
already has better syntax compliance and instruction adherence, reducing the
number of hand-crafted pairs needed.

### Theoretical connection to Code2LoRA

SSD and Code2LoRA are complementary, not redundant:

| Aspect | SSD | Code2LoRA |
|--------|-----|-----------|
| Scope | Global — all coding domains | Local — one repo's API surface |
| Method | Self-distillation (temperature + truncation) | LoRA adaptation |
| What it changes | Token distribution (locks sharper, forks wider) | Weight matrices (low-rank) |
| Labeling cost | Zero — self-generated samples | Low — repo-specific pairs |
| When | One-time per base model | Per repository, at runtime |

SSD solves the **precision-exploration conflict** at the global level.
Code2LoRA then narrows the surviving forks to repo-specific patterns and
hardens the repo-specific locks. The result: a compact edge model that is
simultaneously strong on general coding and exact on local API boundaries.

The paper's theoretical decomposition supports this combination. Equation (4)
shows SSD produces **support compression** (truncation removes distractor
tails) and **within-support reshaping** (temperature reweights the surviving
head). Code2LoRA operates on the already-compressed support — it does not
need to fight the distractor tail, only to shift probability among the
surviving viable tokens.

## The ICL Wire: Analyst → Executor

The analyst does **not** write code or make tool calls. It produces a
structured instruction block that the executor reads in-context.

The ICLContract is a typed Zod schema. It rides in `detail.metadata` on
whatever behavioral event the inference handler receives — no dedicated
snapshot type, no custom event schema.

```typescript
// src/agent/training/training.schemas.ts

export const ICLContractSchema = z.object({
  objective: z.string().describe('One-sentence goal for the executor'),
  patterns_to_apply: z.array(z.string()).describe('Behavioral pattern names or event types to use'),
  constraints: z.array(z.string()).describe('Must-follow rules (must / must-not)'),
  expected_shapes: z.record(z.string(), z.unknown()).describe('Expected payload shapes for generated specs'),
  verification_checklist: z.array(z.string()).describe('Checklist items the executor output must satisfy'),
})

export type ICLContract = z.output<typeof ICLContractSchema>
```

```
┌─────────────────┐     ICL instructions      ┌──────────────────┐
│  Analyst (small)│ ────────────────────────▶ │ Executor (large) │
│  via inference  │   (detail.metadata)       │  via inference   │
│  worker         │   no weight changes       │  worker          │
└─────────────────┘                           └──────────────────┘
```

**Analyst prompt** (low temperature, deterministic):

```
system: You are a Plaited analyst. Given the current Plaited context
(patterns, objectives, prior events), produce concise, structured
instructions that a coding agent should follow to accomplish the task.

user: <onbraid_context_json>

Task: <user_request>
```

**Analyst output** (ICL payload for executor, returned via inference worker):

```json
{
  "objective": "Implement a reactive state selector for the editor topic",
  "patterns_to_apply": ["editor.selection-change", "state.sync"],
  "constraints": ["no direct DOM access", "use behavioral thread `editorFocus`"],
  "expected_shapes": { ... },
  "verification_checklist": ["L1: spec parses", "L2: no deadlock", "L3: uses mock MCP"]
}
```

**Executor prompt** (higher temperature, creative generation):

```
system: You are a Plaited coding agent. Follow the analyst's
instructions precisely. Generate behavioral specs, ACP payloads, and
code that satisfy the stated patterns and constraints.

user:
<analyst_instructions>
${analyst_icl_json}
</analyst_instructions>

Task: ${user_request}
```

The executor's weights are **frozen**. Its behavior changes only when
the analyst's ICL payload changes. This is the definition of
[in-context learning](https://www.ibm.com/think/topics/in-context-learning).

### Why separate analyst from executor?

| Concern | Analyst (small) | Executor (large) |
|---------|----------------|------------------|
| **Training** | Full SFT + LoRA, cheap (~15 GB peak) | Frozen, never trained |
| **ICL style** | Evolves with retraining | Sees new style automatically via prompt |
| **Compute cost** | ~4 GB active, fast | ~52 GB weights, slower but higher quality |
| **Role** | Understand Plaited semantics | Generate structured code and tool calls |
| **Search** | MCP-grounded (Always-Search Policy) | None — works from ICL alone |

## Training Method: Analyst SFT + Verifier-Filtered Dataset

We do **not** use GRPO on the executor. The executor is frozen. Instead:

1. **Collect training pairs**: Run the executor with various analyst
   prompts (hand-written or inference-sampled), execute through the Plaited
   verifier chain (L1–L5), keep only passing trajectories.

2. **Label analyst outputs**: For each passing trajectory, pair the
   analyst's ICL instructions (`detail.metadata.iclContract`) with the
   task and executor output. This becomes the SFT target for the analyst.

3. **SFT the analyst** with Unsloth. The model learns to generate
   ICL instructions that reliably produce verifier-passing executor output.

4. **Evaluate**: Swap the trained analyst weights in, run the same
   task suite, measure L1–L5 pass rate improvement.

### The Training Loop

```
For each task batch:
  1. Sample K task descriptions from Plaited agent history

  2. For each task, generate an analyst prompt from topic context:
     (patterns, objectives, prior snapshots, current topic)

  3. Run analyst via inference worker → generates ICL instructions
     (or use hand-crafted gold instructions for initial training data)

  4. Inject ICL into executor prompt → executor generates specs/code

  5. Run Plaited verifier chain on executor output:

     L1: Structural  → Zod parse
     L2: Symbolic    → behavioral-frontier verify (no deadlock)
     L3: Runtime     → BP engine + snapshot compare + mock MCP
     L4: Protocol    → (verification step TBD per domain)
     L5: End-to-end  → Compile + test

     Early-exit on first failure.

  6. Label: keep the (task, iclContract, executorOutput, verdict) pairs
     for all trajectories that pass the target stage.

  7. SFT the analyst on the labeled dataset.

  8. Swap trained analyst back in, repeat for next curriculum stage.
```

### Curriculum by Verifier Stage

| Stage | Analyst learns | Verifier threshold | Training signal | Batch size |
|-------|---------------|-------------------|-----------------|------------|
| **SSD** | Self-distillation: better reasoning, syntax, instruction adherence | None — self-generated only | SFT on raw samples | ~10K prompts |
| 0 | Bootstrap: hand-crafted instructions + temperature-sampled outputs | L1 only | SFT | 64–128 |
| 1 | Single thread, 2-3 sync points | L1+L2 | SFT | 128–256 |
| 2 | Multi-thread, `waitFor`/`block` coordination | L1+L2 | SFT | 128–256 |
| 3 | Instructions for detail queries | L1+L2+L3 | SFT | 64–128 |
| 4 | Instructions for MCP tool calls + context memory | L1+L2+L3 | SFT | 32–64 |
| 5 | Full pipeline instructions: specs → code → tests | L1–L5 | SFT | 16–32 |

**Rule of thumb**: SSD needs ~10K prompts (single sample each). Stage 0–1
needs ~500 verified pairs. Stage 3–4 needs ~3K. Stage 5 needs ~8K before
pass rates stabilize. SSD replaces none of the later stages — it produces
a better starting point for them.

## Training Data: Snapshot Extraction → Training Pairs

Training pairs are extracted from the existing snapshot JSONL — no SQLite,
no `training_episodes` table. The ICLContract is read from
`detail.metadata.iclContract` on the selected-event snapshot that triggered
the inference.

### TrainingPair Schema

```typescript
export const TrainingPairSchema = z.object({
  task: z.string(),
  iclContract: ICLContractSchema,
  executorOutput: z.string(),
  verdict: z.object({
    pass: z.boolean(),
    score: z.number().min(0).max(1),
    l1: z.boolean(),
    l2: z.boolean(),
    l3: z.boolean(),
  }),
  source: z.object({
    topicId: z.string(),
    trialId: z.string(),
    runId: z.string(),
  }),
})

export type TrainingPair = z.output<typeof TrainingPairSchema>
```

### Extractor sketch

```typescript
// src/agent/training/extract-pairs.ts
import { readSnapshotsIndexed } from '../snapshot.ts'
import { type TrainingPair, TrainingPairSchema } from './training.schemas.ts'

export const extractPairs = async (
  topicId: string,
  opts: { minStage: number; requireModel?: string },
): Promise<TrainingPair[]> => {
  // Read selection snapshots from the topic's JSONL via index files
  const snapshots = await readSnapshotsIndexed(topicId, { kinds: ['selection'] })

  // Find events whose detail carries iclContract in metadata
  const pairs: TrainingPair[] = []

  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i]
    if (snapshot.kind !== 'selection') continue

    const detail = snapshot.selected.detail
    const iclContract = detail?.metadata?.iclContract
    if (!iclContract) continue

    // Pair with next executor response — the response snapshot
    // follows in the stream with a matching correlation id or
    // is the next selection with executor output in detail.
    const responseSnapshot = snapshots[i + 1] // simplified; real impl matches by correlationId
    if (!responseSnapshot || responseSnapshot.kind !== 'selection') continue

    const task = detail?.task ?? ''
    const executorOutput = responseSnapshot.selected.detail?.output ?? ''
    const verdict = deriveVerdict(snapshots.slice(i, i + 10)) // examine surrounding snapshots

    pairs.push(TrainingPairSchema.parse({
      task,
      iclContract,
      executorOutput,
      verdict,
      source: { topicId, trialId: snapshot.selected.type, runId: topicId },
    }))
  }

  return pairs
}
```

### Layout

```
~/.onbraid/training/<run>/
├── pairs.jsonl             ← TrainingPair lines extracted from snapshots
├── config.json             ← Model, stage, hyperparams
└── results.jsonl           ← EvalTrialResult lines (post-grade)
```

### Dataset Versioning and Reproducibility

```
.onbraid/
├── training/
│   ├── runs/
│   │   ├── 2026-06-04T00-00-00-stage-1-analyst/
│   │   │   ├── config.json           # Model, stage, hyperparams
│   │   │   ├── pairs.jsonl           # Extracted from snapshots
│   │   │   ├── lora/                 # LoRA checkpoint
│   │   │   └── metrics.json          # Loss, verifier pass rates
```

## Eval Integration

Training pairs convert to and from `EvalTrial` for use with `onbraid eval`:

```
TrainingPair → EvalTrial:
  task.prompt           = TrainingPair.task
  task.metadata         = { iclContract: TrainingPair.iclContract }
  result.message        = TrainingPair.executorOutput
  result.metadata       = { verifierResults: TrainingPair.verdict }
  snapshots             = (read from source pointers)
  metadata              = { runId, model, stage }
```

Inline `json` graders carry ICL through grading:

```json
{
  "id": "verifier",
  "type": "json",
  "result": {
    "pass": true,
    "score": 0.95,
    "reasoning": "L1-L2-L3 clean",
    "metadata": {
      "iclContract": { "objective": "...", "patterns_to_apply": ["..."], ... },
      "verifierResults": { "L1": "pass", "L2": "pass", "L3": "pass" }
    }
  }
}
```

This means `onbraid eval calibrate` shows reviewers the exact ICL
instructions that produced each trial alongside pass/fail verdicts.

## Always-Search Policy via MCP

The analyst needs external context for patterns beyond its training cutoff.
Instead of hallucinating, the inference worker performs MCP-grounded search
before generating ICL instructions.

### Search Provider Setup

Install a search MCP provider via `onbraid mcp-client`. The recommendation
is You.com's MCP server:

```bash
# Discover available tools
`onbraid mcp-client '{"mode":"discover","url":"https://mcp.you.com"}'

# List search tools
`onbraid mcp-client '{"mode":"list-tools","url":"https://mcp.you.com"}'

# Call search
`onbraid mcp-client '{
  "mode": "call-tool",
  "url": "https://mcp.you.com",
  "tool": "you-search",
  "args": { "query": "latest behavioral pattern best practices" },
  "auth": { "type": "bearer-env", "token": { "envVar": "YDC_API_KEY" } }
}'
```

### Grounding Flow

```
1. Handler receives event with iclContract in detail.metadata
2. Inference worker: if analyst can benefit from external context,
   call MCP search provider with curated query
3. Append search results as <info>...</info> blocks to the prompt
4. Generate ICLContract from grounded context
5. Return to agent handler → inject into executor prompt
```

The search provider URL and tool name are configured in the inference worker
envelope's `searchProvider` field. Context-window bounding is handled by the
worker (limit to top-K results, truncate long documents).

## Code2LoRA Adapters as Workflow Packages

Repository-specific structural patterns can be distilled into LoRA adapters
and packaged as workflow packages. This replaces the concept of a "SkillBook"
with the existing workflow package infrastructure.

### Package Structure

```
.workflows/code-lora-adapter/
├── package.json
│   {
│     "name": "@workflows/code-lora-adapter",
│     "exports": {
│       "./behaviors": "./src/behaviors.ts",
│       "./templates": "./src/templates.ts",
│       "./training": "./training/pairs.jsonl"
│     }
│   }
├── src/behaviors.ts       ← $ === '🎛️' — encodes adapted patterns
├── src/templates.ts       ← $ === '🧩' — optional templates
├── training/
│   ├── pairs.jsonl        ← TrainingPair lines scoped to this adapter
│   └── config.json        ← stage, model, hyperparams
└── skills/                ← optional agent skills
```

### Lifecycle

1. Training pipeline distills patterns into Code2LoRA weights
2. Weights are packaged as a workflow package with `./behaviors` export
3. Package-indexer detects new package via `.workflows/bun.lock` change
4. Agent handler validates `.$ === '🎛️'`, links package into topics
5. Topics reference the adapter in `devDependencies` like any other package

### Why this beats a SkillBook

| Concern | SkillBook | Workflow package |
|---------|-----------|------------------|
| Storage | Proprietary dynamic DB | Git-tracked files in `.workflows/` |
| Discovery | Custom scan loop | Existing `bun.lock` watcher + package-indexer |
| Validation | Ad-hoc schema check | `.$ === '🎛️'` + export shape validation |
| Distribution | Tar + copy | `bun link`, git push, npm |
| Versioning | None | Git history per package |

## Fine-Tuning Pipeline: Unsloth

The analyst is fine-tuned using Unsloth with LoRA. The training container
runs alongside the inference worker — or standalone if training interferes
with serving.

### Training container

```yaml
# docker-compose.train.yml
services:
  unsloth-trainer:
    image: unslothai/unsloth:latest
    container_name: unsloth-trainer
    runtime: nvidia
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
    volumes:
      - ./training-data:/training-data
      - ./models:/models
    environment:
      - CUDA_VISIBLE_DEVICES=0
      - HF_HOME=/root/.cache/huggingface
    command: bash -c "python train_analyst_sft.py"
```

### Analyst SFT script

```python
# training/train_analyst_sft.py
import json
import torch
from datasets import load_dataset
from trl import SFTTrainer, SFTConfig
from unsloth import FastLanguageModel

MODEL = "Qwen/Qwen2.5-Coder-1.5B-Instruct"  # or any sub-2B permissive model
MAX_SEQ_LEN = 32768

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL,
    max_seq_length=MAX_SEQ_LEN,
    load_in_4bit=False,
    fast_inference=True,
    gpu_memory_utilization=0.35,
)

model = FastLanguageModel.get_peft_model(
    model,
    r=64,
    lora_alpha=64,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_dropout=0,
    bias="none",
)

dataset = load_dataset(
    "json",
    data_files="/training-data/pairs.jsonl"
)["train"]

def format_analyst_pair(example: dict) -> dict:
    icl = example["iclContract"]
    if isinstance(icl, dict):
        icl = json.dumps(icl, indent=2)
    return {
        "text": (
            f"<|im_start|>user\n"
            f"{example['task']}\n"
            f"<|im_end|>\n"
            f"<|im_start|>assistant\n"
            f"{icl}\n"
            f"<|im_end|>"
        )
    }

dataset = dataset.map(format_analyst_pair)

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LEN,
    args=SFTConfig(
        output_dir="/models/analyst-lora",
        per_device_train_batch_size=4,
        gradient_accumulation_steps=4,
        num_train_epochs=3,
        learning_rate=2e-4,
        fp16=True,
        logging_steps=10,
        save_strategy="epoch",
        warmup_steps=50,
    ),
)

trainer.train()

# Export merged weights for inference worker
FastLanguageModel.save_pretrained_lora(model, "/models/analyst-lora")
FastLanguageModel.save_pretrained_merged(
    model, tokenizer, "/models/analyst-merged"
)
```

After training, configure the inference worker to point at the merged model
path. The inference worker is model-agnostic — any model served by the
vLLM endpoint works.

## Verifier Chain (Executor Output)

The verifier chain runs on the **executor's output**, not the analyst's.
The analyst is trained on labels derived from which ICL instructions
produced passing executor output.

| Level | Check | Tooling |
|-------|-------|---------|
| **L1** | Structural parse | Zod schema validation |
| **L2** | No deadlock | `onbraid frontier-analysis` / frontier-analysis worker |
| **L3** | Runtime correctness | BP engine + snapshot compare + mock MCP |
| **L4** | Domain-specific | TBD per domain (protocol, schema, etc.) |
| **L5** | End-to-end | Compile + test (shell worker) |

The verifier maps to `command` graders in `onbraid eval grade`, or runs
as behavioral handler calls to existing workers.

## Model Selection and Licensing

The analyst model should be permissively licensed (Apache 2.0, MIT) to
avoid distribution restrictions. Candidates:

| Model | Size | License | Notes |
|-------|------|---------|-------|
| Qwen2.5-Coder-1.5B-Instruct | 1.54B | Apache 2.0 | Structured tool calling, repo-scale context |
| BitNet b1.58 2B4T | 2.4B | MIT | Ternary (1.58-bit), CPU-executable, 0.4 GB footprint |
| Falcon3-1B-1.58bit | 1.0B | Permissive | Ultra-compact, low-power edge |

The executor model has no licensing constraints — it is never distributed
or fine-tuned, only accessed through the inference worker endpoint.

## Integration Checklist

- [ ] Inference worker registered in agent — `src/agent/workers/inference.ts`
- [ ] ICLContractSchema added — `src/agent/training/training.schemas.ts`
- [ ] TrainingPairSchema added — `src/agent/training/training.schemas.ts`
- [ ] Extractor: `src/agent/training/extract-pairs.ts`
- [ ] SFT script: `training/train_analyst_sft.py` (Unsloth)
- [ ] MCP search provider configured via `onbraid mcp-client`
- [ ] Agent wire: analyst first → executor with ICL injection
- [ ] Model endpoint configured (openresponses.org vLLM)

## Source Authority

When behavior is unclear, trust the implementation:
- `src/agent/agent-architecture.md` — Architecture decisions, worker contracts
- `src/behavioral/behavioral.ts` — BP engine
- `src/behavioral/behavioral.schemas.ts` — `SpecSchema`, `BPEventSchema`
- `src/agent/snapshot.ts` — Snapshot JSONL operations
- `src/agent/training/training.schemas.ts` — ICLContract, TrainingPair schemas
- `src/agent/workers/inference.ts` — Inference worker
- `src/cli/eval.ts` — Eval CLI for grading and calibration
- `training/train_analyst_sft.py` — Analyst SFT implementation

## References

| Work | Relevance |
|------|-----------|
| **IBM: In-Context Learning** | [think/topics/in-context-learning](https://www.ibm.com/think/topics/in-context-learning) — core mechanism: learning from prompt examples without weight updates |
| **You.com MCP Server** | [docs/build-with-agents/mcp-server](https://you.com/docs/build-with-agents/mcp-server) — MCP search provider for ASP grounding |
| **SSD (arXiv:2604.01193v1)** | Embarrassingly Simple Self-Distillation — self-generated samples with temperature/truncation, SFT, no verifier. Improves locks (syntax/constraint precision) while preserving forks (diverse exploration). Used as Stage 0 pre-training for the analyst base model. |
| **Qwen2.5-Coder** | Apache 2.0 permissive small model for analyst role |
| **BitNet b1.58** | MIT-licensed ternary model, CPU-inference capable |
| **Unsloth** | Fine-tuning framework for SFT + LoRA |
| **SSD (arXiv:2604.01193)** | Temperature-shifted sampling for diversity |