# Native Model Improvement Program

## Mission

Train Falcon 7B to generate Plaited-native code through large-scale autoresearch data collection and distillation.

**Phase 1 PoC (this program):** Collect 3K high-quality code generation trials on MSI EdgeXpert, distill into Falcon 7B, validate improvement.

**Hardware:** MSI EdgeXpert (Grace Blackwell GB10, 128GB unified memory, local Codex CLI)
**Timeline:** 6-8 hours for 3K trials (8 parallel workers), 12-16 hours for scale
**Cost:** ~$140-160 per run (Sonnet/Haiku judging only; Codex subscription amortized)

## Separation From Other Lanes

This program is distinct from framework development and bounded improvement work.

- **Framework program** (`dev-research/runtime-taxonomy/`)
  - Improves runtime, tooling, harnesses
  - One attempt at a time, human review
- **Native-model program** (this program)
  - Collects 3K+ trials via parallel autoresearch workers
  - Distills Falcon 7B on curated data
  - Scales to production model

Do not merge these concerns.

## Core Hypothesis

Plaited's autoresearch loop (Codex → Sonnet judge → Haiku meta-verify → keep/revise/discard) can scale to produce training data for native model distillation. Falcon, fine-tuned on high-quality Plaited-native outputs, will improve over time and eventually become the preferred producer.

## Target Capabilities

Falcon 7B should become strong at:

- generating modules end-to-end (BP-shaped, constitution-aware)
- generating UI through Plaited's controller/generative UI model
- emitting coordination logic with correct semantics
- respecting constitution and boundary policy
- using `.memory/` and git history as working context
- deciding actor vs sub-agent vs team correctly
- reasoning in Plaited runtime terms, not generic code

## Slice Progression

**Slice 1: Foundation** (setup, ~1 hour)
- Test case/prompt design for Lane B (modules, UI, runtime wiring)
- Evaluation rubric (judge score thresholds, meta-verifier confidence)
- Success criteria for Falcon improvement

**Slices 2A-2H: Parallel Data Collection** (6-8 hours wall-clock, 8 workers)
- 8 independent autoresearch workers (one per slice), each runs 375 attempts
- Slice 2A: Feature branch `native-model-worker-a`
- Slice 2B: Feature branch `native-model-worker-b`
- Slice 2C: Feature branch `native-model-worker-c`
- Slice 2D: Feature branch `native-model-worker-d`
- Slice 2E: Feature branch `native-model-worker-e`
- Slice 2F: Feature branch `native-model-worker-f`
- Slice 2G: Feature branch `native-model-worker-g`
- Slice 2H: Feature branch `native-model-worker-h`
- Each worker: `bun run research:overnight -- ./dev-research/native-model/slice-2X.md --adapter ./scripts/codex-cli-adapter.ts --judge --max-attempts 375`
- Adapter: Codex CLI (existing subscription)
- Judge: Claude Sonnet + Haiku meta-verifier
- Result: 3,000 total generations with judge scores, trajectories, token counts

**Slice 3: Result Analysis & Curation** (1-2 hours)
- Merge all worker results
- Filter by: judge score > 0.85, meta-verifier confidence > 0.8, trajectory richness = full
- Categorize by task type (module, UI, bridge-code, actor decision)
- Label suitability: native-model training vs framework improvement
- Emit: `/tmp/good-outputs.jsonl` (curated training data)

**Slice 4: Falcon Fine-Tuning** (2-4 hours)
- QLoRA fine-tune on curated data
- Baseline: Falcon 7B
- Output: Falcon 7B fine-tuned checkpoint

**Slice 5: Evaluation** (1-2 hours)
- Test baseline vs fine-tuned on held-out Plaited-native eval set
- Measure: score improvement, cost per quality output, training suitability
- Success criteria: measurable improvement, cost < $5 per output

## Execution Model

**Hardware Requirements:**
- MSI EdgeXpert AI Supercomputer (Grace Blackwell GB10)
- 128GB unified memory (sufficient for 8 parallel workers)
- Codex CLI subscription (already owned, $200/month)
- Sonnet API access (for judging)

**Parallelization Strategy:**
- Slices 2A-2H run in parallel on single EdgeXpert machine
- 8 separate `bun run research:overnight` processes, each on own branch
- No coordination needed between workers
- Results collected in Slice 3

**Launch command (from EdgeXpert machine):**
```bash
for i in {a..h}; do
  bun run research:overnight -- ./dev-research/native-model/slice-2$i.md \
    --adapter ./scripts/codex-cli-adapter.ts \
    --judge \
    --max-attempts 375 &
done
wait
```

## Improvement Lanes (Codex-Generated vs Future Falcon)

### Lane A: Framework Scaffolding

Codex outputs that improve tooling/runtime/evals. May be useful for framework but not native-model distillation.

### Lane B: Native Producer Behavior (Primary)

Codex outputs that teach Falcon to generate Plaited-native code. High-quality, multi-dimensional grading. This is the distillation target.

## Data Provenance in Trials

Every trial in Slices 2A-2H captures:

- **Producer:** Codex CLI
- **Judge:** Claude Sonnet (score + dimensions)
- **Meta-verifier:** Claude Haiku (confidence)
- **Task type:** Lane A (scaffolding) or Lane B (native producer)
- **Output type:** Module, UI, bridge-code, actor decision, or combination
- **Judge dimensions:** Architecture (0-1), Boundedness (0-1), Focus (0-1), Quality (0-1)
- **Meta dimensions:** Consistency (0-1), Risk (0-1), Confidence (0-1)
- **Trajectory:** Full (tool calls + reasoning) or minimal (code only)
- **Token usage:** Input/output for cost tracking

Curation in Slice 3 selects trials suitable for Falcon distillation based on:
- Judge score > 0.85
- Meta-verifier confidence > 0.8
- Trajectory richness = full
- Dimensions align with Plaited-native reasoning

## Acceptance Criteria (for Slice-Curated Data)

Retained outputs must demonstrate:

- Correct BP/PM/MSS reasoning (not generic code)
- Constitution-aware behavior
- Proper actor/sub-agent/team decisions
- Quality > 0.80 on judge dimensions
- High meta-verifier confidence (consistency + low risk)

## Eval Themes for Slice 1 Prompt Design

Tasks for Lane B (native producer training):

- Generate a module with BP-shaped actors and matching UI
- Generate runtime taxonomy-aware behavioral coordination
- Produce controller-compatible UI for a Plaited-native intent
- Add constitution-aware bridge-code to existing module
- Use `.memory/` and git history to revise a module correctly
- Choose actor vs sub-agent vs team for bounded work
- Generate MSS-compliant module structure
- Emit correct behavioral thread patterns

## Distillation Policy

**Phase 1 (this program):**
- All Lane B outputs with judge score > 0.85 → Falcon training data
- Lane A outputs → Framework improvement (separate track)
- No filtering by model performance yet (Codex outputs only)

**Phase 2+ (future):**
- Falcon-generated outputs → self-distillation if quality thresholds met
- Separate policy review required before self-improvement

## Safety

Do not allow:
- Falcon to modify its own grading policy
- Codex outputs to bypass judge thresholds without manual review
- Training data to include Lane A (framework scaffolding) data by default
