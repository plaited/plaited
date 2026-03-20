# Slice 1: Foundation - Eval Prompt Calibration

## Target

Run autoresearch to generate and refine 20+ high-quality eval prompts across 8 Lane B themes. Establish judge/meta-verifier rubrics and success thresholds.

**This is a calibration phase:** Generate candidate prompts, test them on 50 trials, keep prompts that lead to >20% quality pass rate.

## Scope

- Generate prompt variations for 8 eval themes (modules, UI, runtime, constitution, memory, decisions, actor decisions, combinations)
- Iterate prompts until 20+ achieve >20% judge score > 0.85 in test trials
- Document judge/meta-verifier rubric with concrete examples
- Establish pass-rate thresholds (target: 10-30% across Slices 2A-2H)

## Required

- Codex CLI adapter (for prompt evaluation)
- Claude Sonnet judge (score prompts on quality signals)
- Claude Haiku meta-verifier (consistency + risk assessment)
- ~50 test iterations to find good prompt templates
- Output: `./eval-prompts.jsonl` (20+ validated prompts)

## Preserve

- Eval themes remain Plaited-specific (BP, PM, MSS, constitution, memory)
- Judge thresholds externally governed (not self-modifying)
- Prompts optimized for Plaited-native reasoning, not generic coding

## Avoid

- Prompts that conflate Lane A (scaffolding) with Lane B (native producer)
- Pass rates < 5% (too strict) or > 50% (too lenient)
- Overfitting to one model or harness

## Acceptance Criteria

- ≥20 distinct prompts generated and validated
- Each prompt has ≥3 test runs showing >20% judge > 0.85 rate
- Judge rubric documented with scoring examples
- Meta-verifier rubric documented (consistency, risk, confidence)
- Success threshold: expect 10-30% pass rate across Slices 2A-2H
- Validation: `bun plaited validate-skill` passes
- Prompts saved to `./eval-prompts.jsonl` for Slices 2A-2H to reference

## Eval Themes

**1. Module Generation (BP-shaped)**
- Prompt: Generate a Plaited module with BP-shaped actors and UI
- Judge: Architecture (BP correctness), Boundedness (single concern), Quality (implementation completeness)

**2. UI Generation (Controller-compatible)**
- Prompt: Generate controller-compatible UI for a Plaited intent
- Judge: Architecture (schema alignment), Focus (single feature), Quality (interactivity)

**3. Runtime Wiring (Coordination)**
- Prompt: Emit coordination logic with correct behavioral thread semantics
- Judge: Architecture (BP correctness), Boundedness (localized reasoning), Quality (semantic precision)

**4. Constitution & Memory**
- Prompt: Add constitution-aware bridge-code that respects .memory/ conventions
- Judge: Architecture (rule enforcement), Focus (narrow scope), Quality (correctness)

**5. Actor vs Sub-Agent Decision**
- Prompt: Decide whether task X should be actor/sub-agent/team and justify
- Judge: Architecture (correct taxonomy), Boundedness (focused reasoning), Quality (clarity)

**6. Plaited-Native Refactoring**
- Prompt: Refactor a module using git history and .memory/ as context
- Judge: Architecture (MSS-aware), Boundedness (change scope), Quality (soundness)

**7. Bridge-Code & Integration**
- Prompt: Generate bridge-code that safely wraps external APIs
- Judge: Architecture (boundary enforcement), Focus (single interface), Quality (safety)

**8. Multi-Dimensional Combinations**
- Prompt: Generate module + UI + coordination + constitution in one task
- Judge: Architecture (all aspects correct), Boundedness (coherent scope), Quality (integration)

## Judge Rubric

Dimensions (0-1 scale):

- **Architecture (0-1):** Follows Plaited patterns (BP, PM, MSS, constitutional)?
- **Boundedness (0-1):** Single concern, not scope creep?
- **Focus (0-1):** Addresses prompt intent without bloat?
- **Quality (0-1):** Implementation correctness and completeness?

**Pass threshold:** All dimensions ≥0.80, aggregate score > 0.85

## Meta-Verifier Rubric

- **Consistency (0-1):** Does reasoning match output?
- **Risk (0-1):** Are gaps or safety concerns flagged?
- **Confidence (0-1):** How confident is the meta-verifier in the primary judge?

**Pass threshold:** Confidence > 0.80 AND Risk < 0.30

## Execution

```bash
bun run research:overnight -- ./dev-research/native-model/slice-1.md \
  --adapter ./scripts/codex-cli-adapter.ts \
  --judge \
  --max-attempts 50
```

Expected runtime: 2-4 hours on local machine or 30-60 min on EdgeXpert.

## Output

**File:** `./eval-prompts.jsonl`

Contains:
- 20+ validated prompt templates
- Judge scores (avg, range)
- Pass rate per theme
- Meta-verifier confidence
- Recommended thresholds for Slices 2A-2H
