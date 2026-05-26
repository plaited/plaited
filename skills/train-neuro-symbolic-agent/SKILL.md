---
name: train-neuro-symbolic-agent
description: >
  Workflow and architecture guidance for training a neuro-symbolic context-assembly
  agent that generates behavioral specs, MCP tool bindings, and ACP payloads instead
  of static skill-based orchestration. Covers verifier-chain self-training,
  curriculum staging, and recommended 2026 tooling.
license: ISC
compatibility: Requires bun, plaited behavioral runtime, and a target base model
---

# train-neuro-symbolic-agent

Use this skill when designing, implementing, or iterating on the training
pipeline for Plaited's neuro-symbolic context-assembly agent.

## When to use

- Planning the training architecture for a model that generates behavioral
  specs instead of static skill scripts.
- Choosing between RL-free training approaches (SSD-style self-distillation,
  ENVISIONS environment-guided self-training, verification-guided SFT).
- Designing the verifier chain (structural → frontier → runtime → end-to-end)
  that filters generated trajectories before they enter training data.
- Selecting fine-tuning frameworks, constrained decoding tools, and evaluation
  harnesses for structured/symbolic output training.
- Deciding what stays in the static `src/skills` scan layer and what becomes
  dynamically generated behavioral threads.

## Core thesis

Static skills (`SKILL.md` + frontmatter + `scripts/*.ts`) go stale because they
are dead files. The model we train should generate **living behavioral specs**
that the Plaited BP engine executes at runtime. The static skill layer becomes
a **scan-and-catalog** phase only — metadata that tells the model what
behavioral specs to generate, not scripts to run.

The agent is an **RLM (Recursive Language Model)** per Zhang et al. (arXiv:2512.24601):
- It treats prompts as external environment objects (SQLite/agent-fs context,
  MCP tool schemas, prior BP snapshots).
- It programmatically slices, queries, and recurses over that environment.
- It outputs **symbolic programs** (behavioral specs, MCP configs, ACP payloads)
  rather than prose context.

## Training method: Hierarchical Execution-Verified Self-Training

No RL (no PPO, GRPO, RLHF, CISPO). No reward model. The verifier chain is the
judge.

### The loop

```
For each training task:
  1. Sample K trajectories from the model
     (temperature-shifted + truncated, à la SSD arXiv:2604.01193)

  2. Run each trajectory through the verifier chain,
     early-exiting on failure:

     L1: Structural  → Zod schema parse (SpecSchema, McpManifestSchema,
                       AgentPromptSchema, UiCapabilityBindingSchema)
     L2: Symbolic   → plaited behavioral-frontier verify
                       (deadlock? unreachable states? block/request conflicts?)
     L3: Runtime    → BP engine + SQLite + isolated MCP sandbox
     L4: Protocol   → ACP round to frozen downstream coder model
     L5: End-to-end → Compile generated code + run tests

  3. SFT on survivors via standard cross-entropy (no RL)

  4. Iterate; optionally DPO on efficiency when multiple trajectories
     pass L5 (prefer shorter/cheaper ones)
```

### Why this works

| Approach | Needs learned reward? | Needs ground-truth? | Needs verifier? |
|----------|----------------------|---------------------|-----------------|
| Context-1 CISPO | Yes (curriculum RL) | Synthetic tasks | Approximate |
| Pure SSD | No | No | No |
| **Plaited VGST** | **No** | **End-to-end tests** | **Deterministic chain** |

Plaited's verifier chain is the advantage. L1 and L2 are essentially free.
Context-1 has no formal pre-execution verifier, so it needs expensive RL.

### Why not pure SSD

SSD (arXiv:2604.01193) samples solutions and fine-tunes without verification.
That works for code because structure correlates with correctness. For
context assembly it fails because assembly quality is extrinsic — you cannot
tell if a retrieved context block helps the coder without executing the pipeline.
Plaited uses SSD-style *sampling* (step 1) but adds the verifier chain (step 2).

## Curriculum by symbolic complexity

| Stage | What the model generates | Verifier target | Signal cost |
|-------|--------------------------|-----------------|-------------|
| **1** | 2-3 syncPoint specs, single thread, no coordination | L1 schema + L2 frontier | Free |
| **2** | Multi-thread specs with `waitFor`/`block` coordination | L2 frontier analysis | Free |
| **3** | Specs + SQLite read/write feeding `detail` payloads | L2 + L3 sandbox | Cheap |
| **4** | Specs + MCP tool calls + context memory integration | L2 + L3 + MCP | Moderate |
| **5** | Full pipeline: specs → context → ACP → coder → passing tests | L1-L5 | Expensive |
| **6** | Multi-hop/iterative: ACP round → read result → reformulate → round 2 | L1-L5 + iteration depth | Expensive |
| **7** | Generated UI capability bindings (`UiCapabilityBinding`) + behavioral specs | L1-L5 + controller event schemas | Expensive |

Stage 1 and 2 flood the model with massive positive signal at zero cost.
Stage 5+ introduces end-to-end filtering only after the symbolic layer is
mastered.

## What stays static vs. what becomes generated

### Static (the scan layer)

The `src/skills` catalog scan remains. It reads `SKILL.md` frontmatter and
produces a lightweight capability registry. But the registry is only **metadata**
for the model, not executable code.

What the scan provides:
- Skill name, description, origin (first-party vs. generated vs. remote-MCP)
- Capability IDs and declared phases (context, analysis, execution...)
- Action verbs and side-effect profiles

### Generated (the runtime layer)

The model turns that metadata into:
- **Behavioral specs** (JSON `Spec` objects consumed by `useSpec`)
- **MCP connection configs** (`McpManifestSchema` + auth resolution)
- **SQLite schemas and queries** for persistent tool state
- **ACP payloads** (`AgentPromptSchema`) for downstream coder communication
- **UI capability bindings** (`UiCapabilityBindingSchema`) for controller integration

### Agent-fs as the state substrate

agent-fs (or an equivalent SQLite-backed virtual filesystem) replaces
skill-local `references/` and `scripts/`. It stores:
- Cached MCP tool schemas and discovery results
- Prior behavioral spec generations (versioned)
- Context assemblies the model has produced
- Connection manifests and refresh tokens

The model reads agent-fs at planning time and writes new specs/configs to it.

## Key research references

| Paper / Work | Relevance |
|--------------|-----------|
| **Zhang et al., "Recursive Language Models" (arXiv:2512.24601)** | Core RLM architecture: LLM manipulates external environment via code/REPL and recursive sub-calls. Maps directly to Plaited's behavioral-runtime-as-environment. |
| **SSD, "Embarrassingly Simple Self-Distillation" (arXiv:2604.01193)** | Temperature-shifted sampling strategy for step 1 of the training loop. Not used as pure method — only for diversity generation before verification. |
| **Chroma Context-1** | Benchmark for what we are *not* doing: pure-neural retrieval with CISPO/RL. Shows why RL is needed when no formal verifier exists. |
| **ENVISIONS (arXiv:2406.11736)** | Environment-guided self-training without teacher or reward model. LLM interacts with environment, generates symbolic traces, SFTs on verified outcomes. Direct precedent for Plaited's L3 sandbox verification. |
| **SLOT (arXiv:2505.04016)** | Structured-output transformer trained via pure SFT on synthetic (text, schema, JSON) triples. Model-agnostic. Relevant for ensuring generated specs, manifests, and configs parse correctly. |
| **ConstraintLLM (arXiv:2510.05774)** | Neuro-symbolic CP framework using Qwen2.5-Coder + LLaMAFactory SFT. Symbolic solver verifies LLM-generated constraint models and feeds corrections back. Pattern: LLM proposes → solver verifies → SFT on corrections. |
| **Self-Verification (arXiv:2212.09561)** | Forward-reasoning + backward-verification scoring. Can be used at inference time (not just training) to rank K sampled trajectories before the verifier chain even runs. |

## Recommended 2026 tooling

### Fine-tuning frameworks (SFT, not RL)

- **LLaMAFactory** (`hiyouga/llamafactory`) — The most widely used open-source
  SFT framework. Supports LoRA, QLoRA, full fine-tuning, multi-GPU. Used by
  ConstraintLLM and many structured-output training pipelines.
  ```bash
  llamafactory-cli train examples/train_lora/qwen2_5_lora_sft.yaml
  ```

- **unsloth** (`unslothai/unsloth`) — 2-5× faster LoRA fine-tuning with 80%
  less VRAM. Supports Qwen3, Llama3, Mistral. Good for rapid iteration on
  the training pipeline before scaling to full fine-tuning.

- **axolotl** (`OpenAccess-AI-Collective/axolotl`) — YAML-configured SFT/DPO
  training. Strong for dataset preparation and multi-format conversation
  templates. Good if you want DPO efficiency refinement (Stage 5+).

### Structured / constrained generation

- **Xgrammar** (`mlc-ai/xgrammar`) — Grammar-constrained decoding engine.
  Enforces JSON Schema / CFG validity at inference time. Can be layered on
  top of any model to guarantee generated specs parse as valid JSON before
  they even reach the Zod verifier.

- **outlines** (`dottxt-ai/outlines`) — Alternative structured generation
  with regex/JSON schema/CFG constraints. Good for Python-centric pipelines.

- **SLOT head** (if building separately) — A small transformer head trained
  to map unstructured LLM text to structured JSON. Decouples task semantics
  from formatting. Only needed if the base model struggles with raw
  structured output.

### Synthetic data generation

- **Claude 3.5/4 Sonnet or GPT-5** — For generating initial synthetic
  (task, spec, manifest, query) training triples. The ENVISIONS paper used
  a stronger model to bootstrap; Plaited can do the same.
- **Self-play (current model sampling)** — After initial bootstrap, use the
  model's own temperature-shifted outputs as the primary data source, à la
  SSD + ENVISIONS.

### Evaluation and verification

- **plaited behavioral-frontier** — L2 formal pre-execution verification.
  Already in the repo. Use `verify` mode on generated spec sets before
  running them.
- **Bun test runner + isolated workers** — L3-L5 runtime verification.
  Spawn generated specs in sandboxed `behavioral()` runtimes, execute MCP
  calls against mock endpoints, compile coder outputs.
- **plaited-eval** — Grading harness for end-to-end quality. Already in
  the repo under `skills/plaited-eval`.

## Training data format (suggested)

Each training example should capture the full trajectory so the model learns
*sequencing* — not just final output:

```ts
type TrainingTrajectory = {
  task: string;                    // User request or coding problem
  context: {
    availableSkills: SkillCatalogEntry[];
    availableMcpServers: McpManifest[];
    priorMemory: ContextMemoryRecord[];
  };
  generatedArtifacts: {
    specs: Spec[];                   // Behavioral thread definitions
    mcpConfig?: McpManifest;       // Connection config for tool use
    sqliteQueries?: string[];       // Read/write operations
    acpPayload: AgentPrompt;        // Downstream coder request
  };
  executionTrace: {
    frontierStatus: FrontierSnapshot;
    snapshots: SnapshotMessage[];   // BP engine execution log
    mcpResults?: McpCallToolResult[];
    coderResponse: AcpResponse;
    testResults?: TestResult[];
  };
  verdict: {
    l1ParseOk: boolean;
    l2FrontierOk: boolean;
    l3RuntimeOk: boolean;
    l4AcpOk: boolean;
    l5TestsPass: boolean;
  };
};
```

Train on trajectories where all verdict layers pass. For Stage 1-2, train
also on partial passes (structural/symbolic ok, runtime not reached) to
bootstrap the model's understanding of BP semantics.

## Integration with existing Plaited surfaces

| Existing module | Role in training |
|-----------------|------------------|
| `src/skills/skills.ts` (`loadSkillRegistry`) | Produces `availableSkills` catalog for model context. Not used for execution. |
| `src/behavioral.ts` + `useSpec` | L2 verification target and L3 runtime engine. |
| `src/mcp.ts` + `mcp.utils.ts` | L3 runtime primitives for tool discovery and execution. |
| `src/agent/context-memory.ts` | L3 persistent state for cross-trajectory learning. |
| `src/agent/ui-bindings.ts` | Stage 7 target: model generates `UiCapabilityBinding` schemas. |
| `skills/plaited-frontier-analysis` | L2 formal verification CLI. |
| `skills/plaited-eval` | L5 end-to-end grading harness. |

## Open questions and next steps

1. **Bootstrap dataset:** How many hand-crafted (task, spec) pairs are needed
   before self-play takes over? ENVISIONS used ~1K environment interactions
   to bootstrap.
2. **MCP mock infrastructure:** We need deterministic mock MCP servers for L3
   verification so training isn't blocked on live network calls.
3. **agent-fs integration:** Should agent-fs be a standalone dependency or
   folded into `src/agent` as a SQLite-backed virtual filesystem layer?
4. **DPO efficiency stage:** At what trajectory volume does DPO on
   shorter-vs-longer passing assemblies become worthwhile?
5. **Generated UI stage:** `src/generated-ui.ts` is incomplete. When it lands,
   the curriculum needs a Stage 7 for UI capability bindings.

## Related skills

- `plaited-frontier-analysis` — L2 formal verification
- `plaited-runtime` — BP semantics and doctrine
- `plaited-eval` — End-to-end grading
- `add-mcp` / `add-remote-mcp` — MCP integration patterns (become generated)
- `agents-md` — AGENTS.md parsing (becomes generated behavioral spec)

## Source authority

When behavior is unclear, trust the implementation:
- `src/behavioral/behavioral.ts` — BP engine execution semantics
- `src/behavioral/behavioral.schemas.ts` — `SpecSchema`, `BPEventSchema`
- `src/skills/skills.schema.ts` — `SkillCatalogEntrySchema`, `SkillRegistryEntrySchema`
- `src/mcp/mcp.schemas.ts` — `McpManifestSchema`, `McpToolSchema`
- `src/agent/agent.schemas.ts` — `AgentPromptSchema`

## Disclaimer

This skill describes an *in-progress architecture*. Many surfaces referenced
(`generated-ui`, agent-fs integration, full training harness) are not yet
implemented. Use this as a design document and iterate. Assign to agents
for implementation work as sub-tasks mature.
