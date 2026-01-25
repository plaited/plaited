# Inline Graders

Inline graders score individual agent outputs in isolation. Each input/output pair is graded independently, producing a pass/fail result with a score.

## Grader Interface

```typescript
import type { Grader } from '@plaited/agent-eval-harness/schemas'

type GraderInput = {
  input: string | string[]      // Original prompt(s)
  output: string                // Agent output
  hint?: string                 // Grader context/expectation
  trajectory?: TrajectoryStep[] // Execution trace
  metadata?: Record<string, unknown> // Optional metadata from prompt
}

type GraderResult = {
  pass: boolean                 // Did it pass?
  score: number                // 0.0 to 1.0
  reasoning?: string           // Explanation
}
```

## Building an Inline Grader

### Step 1: Export the Schema

Get the JSON Schema for validation in any language:

```bash
agent-eval-harness schemas GraderResult --json -o grader-result.json
```

### Step 2: Create the Grader

**TypeScript (recommended):**

```typescript
// my-grader.ts
import type { Grader } from '@plaited/agent-eval-harness/schemas'

export const grade: Grader = async ({ input, output, hint, trajectory, metadata }) => {
  // Your scoring logic here
  const pass = evaluateOutput(output, hint)

  return {
    pass,
    score: pass ? 1.0 : 0.0,
    reasoning: pass ? 'Meets criteria' : 'Does not meet criteria'
  }
}

const evaluateOutput = (output: string, hint?: string): boolean => {
  if (!hint) return true
  return output.toLowerCase().includes(hint.toLowerCase())
}
```

**Python:**

```python
#!/usr/bin/env python3
import json
import sys

data = json.load(sys.stdin)
output = data.get("output", "").lower()
hint = (data.get("hint") or "").lower()

pass_result = hint in output if hint else True

print(json.dumps({
    "pass": pass_result,
    "score": 1.0 if pass_result else 0.0,
    "reasoning": "Contains hint" if pass_result else "Missing hint"
}))
```

### Step 3: Use the Grader

```bash
# With capture command
agent-eval-harness capture prompts.jsonl --schema ./claude.json --grader ./my-grader.ts -o results.jsonl

# With grade command (pipeline)
agent-eval-harness grade extracted.jsonl --grader ./my-grader.ts -o graded.jsonl

# With trials command
agent-eval-harness trials prompts.jsonl --schema ./claude.json -k 5 --grader ./my-grader.ts -o trials.jsonl
```

## Grading Patterns

### Hint-Based Matching

Simple pattern for checking if output contains expected content:

```typescript
export const grade: Grader = async ({ output, hint }) => {
  if (!hint) {
    return { pass: true, score: 1.0, reasoning: 'No hint provided' }
  }

  const contains = output.toLowerCase().includes(hint.toLowerCase())
  return {
    pass: contains,
    score: contains ? 1.0 : 0.0,
    reasoning: contains ? 'Output contains hint' : 'Output missing hint'
  }
}
```

### Multi-Criteria Scoring

Score based on multiple independent criteria:

```typescript
export const grade: Grader = async ({ output, hint, trajectory }) => {
  let score = 0
  const reasons: string[] = []

  // Criterion 1: Contains hint
  if (hint && output.toLowerCase().includes(hint.toLowerCase())) {
    score += 0.4
    reasons.push('Contains expected content')
  }

  // Criterion 2: No tool errors
  const hasErrors = trajectory?.some(s =>
    s.type === 'tool_call' && s.status === 'error'
  )
  if (!hasErrors) {
    score += 0.3
    reasons.push('No tool errors')
  }

  // Criterion 3: Efficient execution
  const toolCount = trajectory?.filter(s => s.type === 'tool_call').length ?? 0
  if (toolCount <= 5) {
    score += 0.3
    reasons.push(`Efficient (${toolCount} tools)`)
  }

  return {
    pass: score >= 0.7,
    score,
    reasoning: reasons.join('; ') || 'Failed all criteria'
  }
}
```

### Metadata-Based Grading

Use metadata for category-specific scoring logic:

```typescript
export const grade: Grader = async ({ output, hint, metadata }) => {
  const category = (metadata?.category as string) ?? 'general'
  const difficulty = (metadata?.difficulty as string) ?? 'medium'

  // Apply different criteria based on category
  if (category === 'code') {
    // Code tasks require syntax validation
    const hasCodeBlock = /```[\s\S]*?```/.test(output)
    if (!hasCodeBlock) {
      return { pass: false, score: 0.0, reasoning: 'Code category requires code block' }
    }
  } else if (category === 'web-search') {
    // Web search tasks require sources
    const hasSources = /source:/i.test(output) || /https?:\/\//.test(output)
    if (!hasSources) {
      return { pass: false, score: 0.5, reasoning: 'Web search should cite sources' }
    }
  }

  // Adjust score threshold by difficulty
  const baseScore = hint ? (output.toLowerCase().includes(hint.toLowerCase()) ? 1.0 : 0.0) : 1.0
  const threshold = difficulty === 'hard' ? 0.9 : difficulty === 'easy' ? 0.6 : 0.7

  return {
    pass: baseScore >= threshold,
    score: baseScore,
    reasoning: `Category: ${category}, Difficulty: ${difficulty}`
  }
}
```

### Trajectory-Based Grading

Analyze the execution path, not just the output:

```typescript
export const grade: Grader = async ({ trajectory }) => {
  const toolCalls = trajectory?.filter(s => s.type === 'tool_call') ?? []

  // Check for required tool usage
  const usedWrite = toolCalls.some(t => t.name === 'Write')
  const usedRead = toolCalls.some(t => t.name === 'Read')

  if (!usedWrite || !usedRead) {
    return {
      pass: false,
      score: 0.0,
      reasoning: `Missing required tools: ${!usedWrite ? 'Write' : ''} ${!usedRead ? 'Read' : ''}`
    }
  }

  return {
    pass: true,
    score: 1.0,
    reasoning: 'Used required Read and Write tools'
  }
}
```

### LLM-as-Judge

Use an LLM for semantic evaluation:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { Grader } from '@plaited/agent-eval-harness/schemas'

const client = new Anthropic()

export const grade: Grader = async ({ input, output, hint }) => {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Evaluate this agent output.

Task: ${Array.isArray(input) ? input.join(' → ') : input}
${hint ? `Expected: ${hint}` : ''}

Agent output:
${output}

Did the agent correctly complete the task? Respond as JSON only:
{"pass": true/false, "score": 0.0-1.0, "reasoning": "brief explanation"}`
    }]
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

  try {
    return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
  } catch {
    return { pass: false, score: 0, reasoning: 'Failed to parse LLM response' }
  }
}
```

## Detection Logic

The harness determines grader type by file extension:

| Extension | Treatment |
|-----------|-----------|
| `.ts`, `.js`, `.mjs`, `.cjs` | Import as ES module |
| Everything else (`.py`, `.sh`, etc.) | Execute as subprocess |

## Executable Protocol

For non-JavaScript graders, use stdin/stdout JSON:

**Input (stdin):**
```json
{
  "input": "Find the CEO of Anthropic",
  "output": "The CEO of Anthropic is Dario Amodei.",
  "hint": "Dario Amodei",
  "trajectory": [...],
  "metadata": {"category": "web-search", "difficulty": "easy"}
}
```

**Output (stdout):**
```json
{
  "pass": true,
  "score": 1.0,
  "reasoning": "Output contains expected name"
}
```

**Exit codes:**
- `0` = Success (result parsed from stdout)
- Non-zero = Error (stderr used for error message)

## Testing Graders

Test independently before using with the harness:

```bash
# TypeScript
echo '{"input":"test","output":"hello world","hint":"world"}' | bun run ./my-grader.ts

# Python
echo '{"input":"test","output":"hello world","hint":"world"}' | ./grader.py

# Shell
echo '{"input":"test","output":"hello world","hint":"world"}' | ./grader.sh
```

## Commands That Support Inline Graders

| Command | Flag | Purpose |
|---------|------|---------|
| `capture` | `--grader` | Add score to each result |
| `trials` | `--grader` | Compute pass@k, pass^k metrics |
| `grade` | `--grader` | Score extracted results (pipeline) |
| `calibrate` | `--grader` | Re-score samples with different grader |
| `validate-refs` | `--grader` | Check reference solutions |

## Best Practices

1. **Grade in isolation** - Each input/output should be scored independently
2. **Deterministic scoring** - Same input should always produce same score
3. **Always return valid JSON** - Use `JSON.stringify()` or `json.dumps()`
4. **Handle missing fields** - `hint` and `trajectory` may be undefined
5. **Include reasoning** - Helps debug failures during calibration
6. **Test independently** - Validate grader before running full eval
7. **Keep graders simple** - Complex logic is hard to debug and calibrate

## Related Documentation

- [comparison-graders.md](comparison-graders.md) - Multi-run comparison graders
- [calibration.md](calibration.md) - Grader calibration workflow
- [eval-concepts.md](eval-concepts.md) - pass@k, pass^k metrics
