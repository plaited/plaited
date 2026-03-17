# Data Format Reference

## Trajectory Format

Trajectories are sequences of `TrajectoryStep` — a discriminated union over five step types. The trial runner captures these via adapters; the training pipeline consumes them as SFT/GRPO inputs.

```typescript
type TrajectoryStep =
  | { type: 'thought';    content: string; timestamp: number; stepId?: string }
  | { type: 'message';    content: string; timestamp: number; stepId?: string }
  | { type: 'tool_call';  name: string; status: string; input?: unknown; output?: unknown; duration?: number; timestamp: number; stepId?: string }
  | { type: 'plan';       entries: AgentPlanStep[]; timestamp: number; stepId?: string }
  | { type: 'decision';   bids: SelectionBid[]; timestamp: number; stepId?: string }
```

### Step Types and Training Relevance

| Step Type | Content | Training Role |
|---|---|---|
| `thought` | Model reasoning (`<think>` blocks) | SFT: teaches reasoning structure |
| `message` | User-facing output | SFT: teaches response formatting |
| `tool_call` | Tool invocation + result | SFT: teaches tool-call format. Dreamer: teaches state transitions |
| `plan` | Multi-step plan proposal | SFT: teaches planning patterns |
| `decision` | BP engine selection state | **Process signal** — deterministic ground truth for training weights |

## DecisionStep Schema

The `decision` step type captures the BP engine's event selection state at each cycle. It records what was requested, blocked, selected, and interrupted — providing deterministic process signal without a learned Process Reward Model.

```typescript
// Canonical source: src/agent/agent.schemas.ts
const DecisionStepSchema = z.object({
  type: z.literal('decision'),
  bids: z.array(SelectionBidSchema),
  timestamp: z.number(),
  stepId: z.string().optional(),
})
```

Each `SelectionBid` in the `bids` array comes from the BP engine's event selection step. The training pipeline uses these to score process quality:

- **Safety gates respected?** — Did the model avoid actions that BP blocked?
- **Coordination patterns followed?** — Were bThread synchronization patterns honored?
- **Unnecessary tool calls avoided?** — Did the model take efficient paths?

### Why DecisionStep Matters for Training

Pre-trained models don't understand behavioral programming constraints. DecisionStep provides the ground truth to teach constraint awareness:

- A trajectory where the model retried a blocked action gets a low process score
- A trajectory where the model re-planned after a block gets a high process score
- This signal is **deterministic** — it comes from the BP engine, not a learned reward model

## GradingDimensions Schema

Three-dimensional scoring for trajectory quality:

```typescript
// Canonical source: src/improve/trial.schemas.ts
const GradingDimensionsSchema = z.object({
  outcome: z.number().min(0).max(1).optional(),   // Correct result?
  process: z.number().min(0).max(1).optional(),    // Sound reasoning?
  efficiency: z.number().min(0).max(1).optional(), // Resource usage vs baseline?
})
```

| Dimension | Signal Source | What It Measures |
|---|---|---|
| `outcome` (0-1) | Grader function / test suite | Did the agent produce the correct result? |
| `process` (0-1) | BP snapshots (DecisionStep) | Were safety gates respected? Were coordination patterns followed? |
| `efficiency` (0-1) | Token/tool/time baselines | Resource usage relative to baseline |

## TrainingScore Schema

Extends GradingDimensions with a computed training weight:

```typescript
// Canonical source: src/improve/training.schemas.ts
const TrainingScoreSchema = GradingDimensionsSchema.extend({
  overall: z.number().min(0).max(1),  // outcome x process
})
```

**`overall = outcome x process`** — a trajectory must be both correct AND well-reasoned to receive high training weight. This prevents reinforcing lucky guesses, retry loops, and brute-force approaches that happen to produce correct output.

## MetaVerification Schema

Detects flaky graders by running them k times and computing confidence intervals:

```typescript
// Canonical source: src/improve/training.schemas.ts
const MetaVerificationSchema = z.object({
  mean: z.number().min(0).max(1),
  stddev: z.number().min(0),
  min: z.number().min(0).max(1),
  max: z.number().min(0).max(1),
  k: z.number().int().positive(),
  scores: z.array(z.number().min(0).max(1)),
})
```

Stored in `outcome._metaVerification` on the `GraderResult`. High `stddev` indicates inconsistent scoring — the grader's signal should not be trusted for training data.

### Usage in Training

The `withMetaVerification` wrapper (from `src/improve/trial.utils.ts`) runs a grader multiple times and produces a `MetaVerification` result. During probing phase, this catches grader failures before they corrupt training signal:

1. Grader runs k times on the same trajectory
2. MetaVerification computes mean, stddev, min, max
3. If stddev exceeds threshold, the trajectory is flagged for manual review
4. Only trajectories with stable grading feed the training pipeline

## Data Flow Summary

```
Trial Runner (captures trajectories with DecisionStep)
  -> GradingDimensions (outcome + process + efficiency)
  -> TrainingScore (overall = outcome x process)
  -> MetaVerification (grader stability check)
  -> SFT data (high overall) / GRPO pairs (above/below group mean)
```
