# Graders

Graders provide semantic pass/fail scoring for captured trajectories. The harness supports graders written in **any language**.

## Detection Logic

The harness determines grader type by file extension:

| Extension | Treatment |
|-----------|-----------|
| `.ts`, `.js`, `.mjs`, `.cjs` | Import as ES module |
| Everything else (`.py`, `.sh`, etc.) | Execute as subprocess |

## TypeScript Grader

Export a `grade` function matching the `Grader` type:

```typescript
// my-grader.ts
import type { Grader } from '@plaited/acp-harness/schemas'

export const grade: Grader = async ({ input, output, expected, trajectory }) => {
  // Your scoring logic
  const pass = output.toLowerCase().includes(expected?.toLowerCase() ?? '')
  return {
    pass,
    score: pass ? 1 : 0,
    reasoning: pass ? 'Contains expected answer' : 'Missing expected answer'
  }
}
```

**Usage:**
```bash
acp-harness capture prompts.jsonl bunx claude-code-acp --grader ./my-grader.ts -o results.jsonl
```

## Python Grader

Use stdin/stdout JSON protocol:

```python
#!/usr/bin/env python3
"""
Grader that checks if output contains expected answer.
Make executable: chmod +x grader.py
"""
import json
import sys

# Read input from stdin
data = json.load(sys.stdin)

# Extract fields
output = data.get("output", "").lower()
expected = (data.get("expected") or "").lower()

# Scoring logic
pass_result = expected in output if expected else True

# Write result to stdout
print(json.dumps({
    "pass": pass_result,
    "score": 1.0 if pass_result else 0.0,
    "reasoning": "Contains expected" if pass_result else "Missing expected"
}))
```

**Usage:**
```bash
chmod +x ./grader.py
acp-harness capture prompts.jsonl bunx claude-code-acp --grader ./grader.py -o results.jsonl
```

## Executable Protocol

Any executable can be a grader using stdin/stdout JSON:

**Input (stdin):**
```json
{
  "input": "Find the CEO of Anthropic",
  "output": "The CEO of Anthropic is Dario Amodei.",
  "expected": "Dario Amodei",
  "trajectory": [
    {"type": "thought", "content": "I'll search...", "timestamp": 100},
    {"type": "tool_call", "name": "WebSearch", "status": "completed", ...},
    {"type": "message", "content": "The CEO is...", "timestamp": 500}
  ]
}
```

**Output (stdout):**
```json
{
  "pass": true,
  "score": 1.0,
  "reasoning": "Output contains expected CEO name"
}
```

**Exit codes:**
- `0` = Success (result parsed from stdout)
- Non-zero = Error (stderr message used for error reporting)

## GraderResult Schema

All graders must return this structure:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pass` | boolean | Yes | Whether the result passes |
| `score` | number | Yes | Score between 0.0 and 1.0 |
| `reasoning` | string | No | Explanation of the score |

## Shell Script Grader

```bash
#!/bin/bash
# grader.sh - Check if output mentions expected keyword

# Read JSON from stdin
INPUT=$(cat)

# Extract fields with jq
OUTPUT=$(echo "$INPUT" | jq -r '.output // ""')
EXPECTED=$(echo "$INPUT" | jq -r '.expected // ""')

# Check if output contains expected (case-insensitive)
if echo "$OUTPUT" | grep -qi "$EXPECTED"; then
  echo '{"pass": true, "score": 1.0, "reasoning": "Contains expected"}'
else
  echo '{"pass": false, "score": 0.0, "reasoning": "Missing expected"}'
fi
```

## LLM-as-Judge Grader

Wrap an LLM call in your grader for semantic evaluation:

```typescript
// llm-judge.ts
import Anthropic from '@anthropic-ai/sdk'
import type { Grader } from '@plaited/acp-harness/schemas'

const client = new Anthropic()

export const grade: Grader = async ({ input, output, expected }) => {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Task: ${input}
Expected: ${expected || 'N/A'}
Agent output: ${output}

Did the agent correctly complete the task? Respond with JSON:
{"pass": true/false, "score": 0.0-1.0, "reasoning": "brief explanation"}`
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text)
}
```

## Testing Graders

Test graders independently before using with the harness:

```bash
# Test Python grader
echo '{"input":"hello","output":"hello world","expected":"world"}' | ./grader.py

# Test shell grader
echo '{"input":"test","output":"the answer is 42","expected":"42"}' | ./grader.sh
```

## Commands That Support Graders

| Command | Flag | Purpose |
|---------|------|---------|
| `capture` | `--grader` | Add score to each result |
| `trials` | `--grader` | Compute pass@k, pass^k metrics |
| `calibrate` | `--grader` | Re-score samples with different grader |
| `validate-refs` | `--grader` | Check reference solutions |

## Best Practices

1. **Keep graders simple** - Complex logic is hard to debug
2. **Always return valid JSON** - Use `json.dumps()` or `JSON.stringify()`
3. **Handle missing fields** - `expected` and `trajectory` may be undefined
4. **Include reasoning** - Helps debug failures later
5. **Test independently** - Validate grader before running full eval
