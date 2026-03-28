---
name: modnet-modules
description: Module generation eval prompts and grading guidance adapted from MiniAppBench methodology. The active operator prompt corpus lives under `dev-research/training-prompts/catalog/`; this skill provides the rubric and legacy prompt fixtures used for calibration and comparison work.
license: ISC
compatibility: Requires bun
---

# Modnet Modules

## Purpose

Eval prompts and grading infrastructure for module generation quality. Adapted from MiniAppBench's three-dimension methodology:

| MiniAppBench | Modnet Adaptation | Grading Dimension |
|---|---|---|
| Intention | MSS specification adherence + user goal fulfillment | `outcome` |
| Static | Package structure, types, SKILL.md, modnet field | `process` |
| Dynamic | Behavioral programs, UI rendering, state transitions | `efficiency` |

**Use when:**
- Running module generation eval trials
- Grading generated module output quality
- Comparing model performance on module generation
- Calibrating module generation skills

## Prompt Corpus

The authoritative prompt-review corpus is:

- `dev-research/training-prompts/catalog/prompts.jsonl`

That catalog is the live source used by the modnet prompt-review workflow (`pi:review`).

Do not treat this skill as owning a separate prompt corpus. The prompt source of truth is the training-prompts catalog.

## Prompt Format

Prompts are JSONL conforming to `PromptCaseSchema` from `src/improve.ts`:

```jsonl
{"id":"<id>","input":"<generation prompt>","hint":"<implementation hints>","metadata":{"domain":"<domain>","subclass":"<subclass>","difficulty":"<Easy|Medium|Hard>","eval_ref":{"intention":[...],"static":[...],"dynamic":[...]},"mss":{"contentType":"...","structure":"...","mechanics":[...],"boundary":"...","scale":<n>},"dependencies":[...]}}
```

### Metadata Fields

| Field | Type | Description |
|---|---|---|
| `domain` | string | Top-level category (Data, Social, Visualization, Tools, Creative, Science) |
| `subclass` | string | Specific subcategory within domain |
| `difficulty` | string | Easy, Medium, or Hard |
| `eval_ref.intention` | string[] | Goal-fulfillment checklist items |
| `eval_ref.static` | string[] | Structural correctness checklist items |
| `eval_ref.dynamic` | string[] | Runtime behavior checklist items |
| `mss` | object | Expected MSS tags for the generated module |
| `dependencies` | string[] | Expected npm dependencies |

## Prompt Categories

The active corpus currently contains 25 prompts across 8 domains:

| Domain | Count | Prompts |
|---|---|---|
| Data | 6 | diet-tracker, expense-logger, inventory-manager, reading-list, recipe-manager, task-board |
| Social | 3 | bluesky-client (flagship), chat-module, discussion-forum |
| Visualization | 3 | weather-dashboard, chart-generator, interactive-map |
| Tools | 5 | unit-converter, calendar-module, markdown-editor, color-palette, file-organizer |
| Creative | 3 | portfolio-gallery, drawing-canvas, playlist-manager |
| Science | 3 | physics-simulator, periodic-table, statistics-calculator |
| Finance | 1 | crypto-tracker |
| Education | 1 | quiz-builder |

## Grading

Use the module grader at `src/tools/module-grader.ts`:

```typescript
import { createModuleGrader } from '../tools/module-grader.ts'

const grader = createModuleGrader()
// or with LLM judge:
const grader = createModuleGrader({ judge: myJudgeFunction })
```

Three-dimension scoring maps to `GradingDimensions`:
- **outcome** (Intention): LLM-as-judge or keyword matching against `eval_ref.intention`
- **process** (Static): Automated checks (parse, tsc, package.json, SKILL.md, modnet field)
- **efficiency** (Dynamic): Code analysis for event handlers, state management, UI rendering

## Running Trials

```typescript
import { runTrial } from '../improve.ts'
import { grade } from '../tools/module-grader.ts'

const results = await runTrial({
  adapter: myAdapter,
  prompts: await loadPrompts('dev-research/training-prompts/catalog/prompts.jsonl'),
  grader: grade,
  k: 5,
  concurrency: 2,
  workspaceDir: './workspaces',
})
```

## Prompt Source

- **`dev-research/training-prompts/catalog/prompts.jsonl`** — Active operator prompt corpus

## Related Skills

- **mss** — MSS tag definitions and composition rules
- **modnet-node** — Module architecture and workspace patterns
- **trial-runner** — Trial execution infrastructure
- **compare-trials** — Statistical comparison of trial results
