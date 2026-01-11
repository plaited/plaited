# Downstream Integration

Patterns for piping harness output to analysis tools.

## Loading Results

Both output formats use JSONL (newline-delimited JSON):

```typescript
// TypeScript pattern (validated in tests)
const parseResults = (jsonl: string) =>
  jsonl.trim().split('\n').map((line) => JSON.parse(line))

// Load from file
const results = parseResults(await Bun.file('results.jsonl').text())
```

## jq Analysis

Summary JSONL is designed for quick analysis with `jq`:

```bash
# Calculate average duration
cat results.jsonl | jq -s 'map(.duration) | add / length'

# Count tool usage
cat results.jsonl | jq -s 'map(.toolCalls) | flatten | group_by(.) | map({tool: .[0], count: length})'

# Filter by status
cat results.jsonl | jq 'select(.status == "failed")'

# Pass rate
cat results.jsonl | jq -s 'map(select(.status == "passed")) | length as $p | length as $t | "\($p)/\($t) passed"'

# Group by category
cat results.jsonl | jq -s 'group_by(.metadata.category) | map({category: .[0].metadata.category, count: length})'

# Find slowest evaluations
cat results.jsonl | jq -s 'sort_by(-.duration) | .[0:5] | map({id, duration})'
```

## TypeScript Analysis Patterns

These patterns are validated by tests in `scripts/tests/run-harness.spec.ts`:

### Filter by Status

```typescript
const failed = results.filter((r) => r.status === 'failed')
const passed = results.filter((r) => r.status === 'passed')
const passRate = passed.length / results.length
```

### Filter by Tool Usage

```typescript
// Find evaluations that used Write tool
const withWrite = results.filter((r) => r.toolCalls.includes('Write'))

// Find evaluations that used multiple tools
const multiTool = results.filter((r) => r.toolCalls.length > 1)
```

### Filter by Duration

```typescript
// Slow evaluations (> 2 seconds)
const slow = results.filter((r) => r.duration > 2000)

// Find top 5 slowest
const slowest = [...results].sort((a, b) => b.duration - a.duration).slice(0, 5)
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
const allTools = results.flatMap((r) => r.toolCalls)
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

For judge format, correlate markdown step IDs with full JSONL:

```typescript
// Load both files
const markdown = await Bun.file('results.md').text()
const fullResults = parseResults(await Bun.file('results.full.jsonl').text())

// Build step index
const stepIndex = new Map<string, unknown>()
for (const result of fullResults) {
  for (const step of result.trajectory) {
    stepIndex.set(step.stepId, step)
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

## LLM-as-Judge

### Large Context Models (Gemini 1M+)

Feed full trajectory directly:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' })

const results = parseResults(await Bun.file('results.full.jsonl').text())

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

Use full trajectory for most evaluations:

```typescript
import Anthropic from '@anthropic-ai/sdk'

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
      passed: result.status === 'passed' ? 1 : 0,
      duration_ms: result.duration,
    },
    metadata: {
      ...result.metadata,
      toolCalls: result.toolCalls,
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

      - name: Run evaluation
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          bun .claude/skills/acp-harness/scripts/run-harness.ts \
            prompts.jsonl \
            --format judge \
            --progress \
            -o eval-results

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: |
            eval-results.md
            eval-results.full.jsonl
```

## Output Aggregation

Combine multiple runs:

```bash
# Append mode during runs
bun scripts/run-harness.ts prompts-1.jsonl --append -o combined.jsonl
bun scripts/run-harness.ts prompts-2.jsonl --append -o combined.jsonl

# Merge separate files
cat run1.jsonl run2.jsonl run3.jsonl > combined.jsonl

# Dedupe by ID (keep latest) - use TypeScript pattern above
```
