---
description: Scaffold evaluation assets for comparing Claude Code one-shots vs trained World Agent
allowed-tools: Write, Bash, AskUserQuestion, Read
---

# Create World Agent Eval Assets

Scaffold evaluation assets for your project to compare baseline generation (Claude Code with skills) against a purpose-trained World Agent.

**Output Directory:** $ARGUMENTS (default: `.claude/eval`)

## Instructions

### Step 1: Get Output Directory

If no directory provided in $ARGUMENTS, use `.claude/eval` as default.

### Step 2: Ask About Evaluation Scope

Use AskUserQuestion to ask:

**Question 1:** "What type of templates will you evaluate?"
**Options:**
1. **UI Templates** - bElements, functional templates, forms
2. **Design System** - Token-based templates with style variations
3. **Mixed** - Both UI and design system templates

**Question 2:** "What baseline model should Claude Code use for one-shot comparison?"
**Options:**
1. **Claude Sonnet 4** (Recommended) - Fast, capable, cost-effective
2. **Claude Opus 4** - Highest capability
3. **Custom** - User provides model ID

### Step 3: Create Eval Directory Structure

Create the following structure:

```
[output-dir]/
├── config.json           # Evaluation configuration
├── templates/            # Test case templates
│   └── .gitkeep
├── prompts/              # Custom evaluation prompts
│   ├── task-completion.md
│   └── quality-check.md
└── baselines/            # Baseline outputs for comparison
    └── .gitkeep
```

### Step 4: Create config.json

```json
{
  "baselineModel": "[selected-model]",
  "templateType": "[selected-type]",
  "skills": [
    "plaited-ui-patterns",
    "plaited-behavioral-core",
    "plaited-standards"
  ],
  "metrics": {
    "functional": ["storyPass", "typeCheck", "a11yPass"],
    "quality": ["patternCompliance", "tokenUsage", "codeStyle"],
    "trajectory": ["toolEfficiency", "constraintViolations", "iterationCount"]
  },
  "thresholds": {
    "minStoryPassRate": 0.9,
    "maxIterations": 3,
    "minA11yScore": 1.0
  }
}
```

### Step 5: Create Prompt Templates

**task-completion.md:**
```markdown
# Task Completion Evaluation

Evaluate whether the generated template meets the requirements.

## Criteria

1. **Functional Correctness** - Does the template render and behave correctly?
2. **Type Safety** - Does it pass TypeScript type checking?
3. **Accessibility** - Does it pass a11y assertions?
4. **Pattern Compliance** - Does it follow Plaited patterns?

## Scoring

- PASS: All criteria met
- PARTIAL: 2-3 criteria met
- FAIL: 0-1 criteria met
```

**quality-check.md:**
```markdown
# Quality Check Evaluation

Evaluate code quality beyond functional requirements.

## Criteria

1. **Token Usage** - Uses design tokens, not raw values
2. **Code Style** - Follows Plaited conventions
3. **Composition** - Appropriate use of patterns from registry
4. **Maintainability** - Clear structure, proper naming

## Scoring (1-5)

5: Exemplary - Could serve as reference
4: Good - Minor improvements possible
3: Acceptable - Meets requirements
2: Needs Work - Significant improvements needed
1: Poor - Major issues
```

### Step 6: Confirm Creation

Tell the user:

1. Eval assets created at `[output-dir]/`
2. Baseline model: [selected-model]
3. Template type: [selected-type]

**Next steps:**
1. Add test templates to `[output-dir]/templates/`
2. Run baseline generation: `bun .claude/skills/world-agent/scripts/compare-baseline.ts [output-dir]`
3. Review report: `bun .claude/skills/world-agent/scripts/generate-report.ts [output-dir]`

## Usage After Setup

### Running Evaluations

```bash
# Run full eval suite
bun .claude/skills/world-agent/scripts/run-eval-suite.ts .claude/eval

# Compare baseline (Claude Code) vs World Agent
bun .claude/skills/world-agent/scripts/compare-baseline.ts .claude/eval

# Generate human-readable report
bun .claude/skills/world-agent/scripts/generate-report.ts .claude/eval
```

### Adding Test Cases

Add story files to `[output-dir]/templates/`:

```typescript
// templates/button-primary.stories.tsx
import { story } from 'plaited/testing'
import { PrimaryButton } from '@/templates/button'

export const meta = {
  title: 'Button/Primary',
  intent: 'Create a primary action button with hover state'
}

export const Default = story({
  template: PrimaryButton,
  play: async ({ assert }) => {
    await assert.a11y()
    await assert.snapshot()
  }
})
```

The `meta.intent` field is used as the prompt for both baseline and agent generation.

## Related Skills

- **world-agent** - Agent infrastructure and training
- **plaited-ui-patterns** - Template patterns for evaluation
- **workbench** - Story discovery and execution
