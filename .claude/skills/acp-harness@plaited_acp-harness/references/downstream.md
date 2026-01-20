# Downstream Integration

Patterns for piping harness output to analysis tools.

## Loading Results

All output formats use JSONL (newline-delimited JSON):

```typescript
// TypeScript pattern (validated in tests)
const parseResults = (jsonl: string) =>
  jsonl.trim().split('\n').map((line) => JSON.parse(line))

// Load from file
const results = parseResults(await Bun.file('results.jsonl').text())
```

## jq Analysis

Use `summarize` command for quick jq analysis:

```bash
# First derive summary
acp-harness summarize results.jsonl -o summary.jsonl

# Calculate average duration
cat summary.jsonl | jq -s 'map(.duration) | add / length'

# Count tool usage
cat summary.jsonl | jq -s 'map(.toolCalls) | flatten | group_by(.) | map({tool: .[0], count: length})'

# Group by category (from full results)
cat results.jsonl | jq -s 'group_by(.metadata.category) | map({category: .[0].metadata.category, count: length})'

# Find slowest runs
cat summary.jsonl | jq -s 'sort_by(-.duration) | .[0:5] | map({id, duration})'

# Find results with tool errors
cat results.jsonl | jq 'select(.toolErrors == true)'
```

## TypeScript Analysis Patterns

These patterns are validated by tests in `bin/tests/cli.spec.ts`:

### Filter by Tool Errors

```typescript
// Results where any tool call failed
const withErrors = results.filter((r) => r.toolErrors)
const noErrors = results.filter((r) => !r.toolErrors)
```

### Filter by Grader Score (if grader was used)

```typescript
// When using --grader flag, results have a score field
const passed = results.filter((r) => r.score?.pass)
const failed = results.filter((r) => r.score && !r.score.pass)
const passRate = passed.length / results.length
```

### Filter by Tool Usage

```typescript
// Find runs that used Write tool (from trajectory)
const withWrite = results.filter((r) =>
  r.trajectory.some((s) => s.type === 'tool_call' && s.name === 'Write')
)

// From summary format
const summaries = parseResults(await Bun.file('summary.jsonl').text())
const withWriteSummary = summaries.filter((r) => r.toolCalls.includes('Write'))
```

### Filter by Duration

```typescript
// Slow runs (> 2 seconds)
const slow = results.filter((r) =>
  (r.timing.end - r.timing.start) > 2000
)

// Find top 5 slowest
const slowest = [...results]
  .sort((a, b) => (b.timing.end - b.timing.start) - (a.timing.end - a.timing.start))
  .slice(0, 5)
```

### Filter by Metadata

```typescript
// Filter by category
const uiResults = results.filter((r) => r.metadata.category === 'ui')

// Group and count by category
const grouped = results.reduce<Record<string, number>>((acc, r) => {
  const cat = r.metadata.category as string
  acc[cat] = (acc[cat] ?? 0) + 1
  return acc
}, {})
```

### Count Tool Usage

```typescript
const allTools = results.flatMap((r) =>
  r.trajectory.filter((s) => s.type === 'tool_call').map((s) => s.name)
)
const toolCounts = allTools.reduce<Record<string, number>>((acc, tool) => {
  acc[tool] = (acc[tool] ?? 0) + 1
  return acc
}, {})
```

### Deduplicate by ID

```typescript
// Keep latest occurrence when merging multiple runs
const byId = new Map<string, unknown>()
for (const result of results) {
  byId.set(result.id, result)
}
const deduped = Array.from(byId.values())
```

## Step-Level Retrieval

Correlate step IDs from markdown summary with full trajectory:

```typescript
// Load full results
const results = parseResults(await Bun.file('results.jsonl').text())

// Build step index
const stepIndex = new Map<string, unknown>()
for (const result of results) {
  for (const step of result.trajectory) {
    if (step.stepId) {
      stepIndex.set(step.stepId, step)
    }
  }
}

// Retrieve full step by ID (from markdown [→stepId])
const stepId = 'test-001-step-2'
const fullStep = stepIndex.get(stepId) as { name: string; input: unknown }
console.log('Tool name:', fullStep.name)
console.log('Full input:', fullStep.input)
```

## Extract Tool Calls from Trajectory

```typescript
const toolCalls = result.trajectory.filter((s) => s.type === 'tool_call')
const toolNames = toolCalls.map((t) => t.name)
```

## Timing Information

```typescript
const result = results[0]
const duration = result.timing.end - result.timing.start
const timeToFirstResponse = result.timing.firstResponse // ms after start
```

## Grader Integration

Use the `--grader` flag to add scoring to capture results. The harness supports graders written in **any language**.

### TypeScript Grader

```typescript
// my-grader.ts
import type { Grader } from '@plaited/acp-harness/schemas'

export const grade: Grader = async ({ input, output, expected, trajectory }) => {
  const pass = output.toLowerCase().includes(expected?.toLowerCase() ?? '')
  return {
    pass,
    score: pass ? 1 : 0,
    reasoning: pass ? 'Contains expected answer' : 'Missing expected answer'
  }
}
```

```bash
acp-harness capture prompts.jsonl bunx claude-code-acp --grader ./my-grader.ts -o results.jsonl
```

### Python Grader

Python graders use stdin/stdout JSON protocol:

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
trajectory = data.get("trajectory", [])

# Example: check tool usage in trajectory
used_write = any(
    step.get("type") == "tool_call" and step.get("name") == "Write"
    for step in trajectory
)

# Scoring logic
pass_result = expected in output if expected else True

# Write result to stdout
print(json.dumps({
    "pass": pass_result,
    "score": 1.0 if pass_result else 0.0,
    "reasoning": f"Contains expected: {pass_result}, Used Write tool: {used_write}"
}))
```

```bash
chmod +x ./grader.py
acp-harness capture prompts.jsonl bunx claude-code-acp --grader ./grader.py -o results.jsonl
```

### Detection Logic

The harness determines grader type by file extension:

| Extension | Treatment |
|-----------|-----------|
| `.ts`, `.js`, `.mjs`, `.cjs` | Import as ES module |
| Everything else (`.py`, `.sh`, etc.) | Execute as subprocess |

### Testing Graders Independently

Test graders before using with the harness:

```bash
# Test Python grader
echo '{"input":"hello","output":"hello world","expected":"world"}' | ./grader.py

# Test shell grader
echo '{"input":"test","output":"the answer is 42","expected":"42"}' | ./grader.sh
```

### Output Format

Results will include a `score` field:

```jsonl
{"id":"test-001",...,"score":{"pass":true,"score":1.0,"reasoning":"Contains expected answer"}}
```

See [graders.md](graders.md) for complete documentation including shell scripts and LLM-as-judge patterns.

## LLM-as-Judge

### Large Context Models (Gemini 1M+)

Feed full trajectory directly:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' })

const results = parseResults(await Bun.file('results.jsonl').text())

const prompt = `
Evaluate these agent trajectories for code quality and reasoning.

${JSON.stringify(results, null, 2)}

For each evaluation, score 1-3:
- 1: Major issues (wrong tools, broken logic, incorrect output)
- 2: Minor issues (inefficient but correct)
- 3: Excellent (efficient trajectory, correct output)

Respond as JSON array: [{"id": "...", "score": N, "reasoning": "..."}]
`

const response = await model.generateContent(prompt)
console.log(response.response.text())
```

### Medium Context Models (Claude 200k)

Use markdown summary for smaller context:

```typescript
import Anthropic from '@anthropic-ai/sdk'

// Generate markdown summary first
await Bun.$`acp-harness summarize results.jsonl --markdown -o results.md`

const client = new Anthropic()
const markdown = await Bun.file('results.md').text()

const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  messages: [{
    role: 'user',
    content: `Evaluate these agent trajectories:\n\n${markdown}\n\nScore each 1-3 and explain.`
  }]
})

console.log(response.content[0].text)
```

## Braintrust Integration

Upload results programmatically:

```typescript
import { initLogger } from 'braintrust'

const logger = initLogger({
  projectName: 'agent-eval',
  apiKey: process.env.BRAINTRUST_API_KEY,
})

const results = parseResults(await Bun.file('results.jsonl').text())

for (const result of results) {
  logger.log({
    input: result.input,
    output: result.output,
    expected: result.expected,
    scores: {
      toolErrors: result.toolErrors ? 0 : 1,
      duration_ms: result.timing.end - result.timing.start,
      // Include grader score if available
      ...(result.score && { passed: result.score.pass ? 1 : 0 }),
    },
    metadata: {
      ...result.metadata,
      toolCalls: result.trajectory
        .filter((s) => s.type === 'tool_call')
        .map((s) => s.name),
    },
  })
}

await logger.flush()
```

## CI Integration

### GitHub Actions

```yaml
name: Agent Eval
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2

      - name: Install ACP adapter
        run: npm install -g @zed-industries/claude-code-acp

      - name: Install dependencies
        run: bun add @plaited/acp-harness

      - name: Run harness
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          bunx @plaited/acp-harness capture prompts.jsonl \
            bunx claude-code-acp \
            --progress \
            -o results.jsonl

      - name: Generate summary
        run: |
          bunx @plaited/acp-harness summarize results.jsonl -o summary.jsonl
          bunx @plaited/acp-harness summarize results.jsonl --markdown -o results.md

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: |
            results.jsonl
            summary.jsonl
            results.md
```

## Output Aggregation

Combine multiple runs:

```bash
# Append mode during runs
acp-harness capture prompts-1.jsonl bunx claude-code-acp --append -o combined.jsonl
acp-harness capture prompts-2.jsonl bunx claude-code-acp --append -o combined.jsonl

# Merge separate files
cat run1.jsonl run2.jsonl run3.jsonl > combined.jsonl

# Dedupe by ID (keep latest) - use TypeScript pattern above
```

## Trials for Non-Determinism Analysis

Use the `trials` command to measure pass@k/pass^k:

```bash
acp-harness trials prompts.jsonl bunx claude-code-acp -k 5 --grader ./grader.ts -o trials.jsonl
```

```typescript
const trials = parseResults(await Bun.file('trials.jsonl').text())

for (const result of trials) {
  console.log(`${result.id}:`)
  console.log(`  Pass rate: ${(result.passRate * 100).toFixed(1)}%`)
  console.log(`  pass@${result.k}: ${(result.passAtK * 100).toFixed(1)}%`)
  console.log(`  pass^${result.k}: ${(result.passExpK * 100).toFixed(1)}%`)
}
```
