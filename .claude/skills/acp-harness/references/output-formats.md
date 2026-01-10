# Output Formats

The harness supports two output formats optimized for different use cases.

## Format Selection

```bash
bun scripts/run-harness.ts prompts.jsonl --format <format> -o <output>
```

| Format | Files Created | Use Case |
|--------|---------------|----------|
| `summary` | Single JSONL | Quick metrics, dashboards, jq analysis |
| `judge` | `.md` + `.full.jsonl` | LLM-as-judge evaluation |

## Summary Format (Default)

Minimal JSONL for quick metrics and analysis.

### Schema

```typescript
type SummaryResult = {
  id: string                    // Prompt identifier
  input: string                 // Original prompt text
  output: string                // Final agent response
  toolCalls: string[]           // List of tool names used
  status: 'passed' | 'failed' | 'error' | 'timeout'
  duration: number              // Total execution time (ms)
}
```

### Example Output

```jsonl
{"id":"test-001","input":"Create a primary button","output":"I created the button in src/button.tsx","toolCalls":["Write"],"status":"passed","duration":1234}
{"id":"test-002","input":"Fix the TypeScript error","output":"I fixed the type error...","toolCalls":["Read","Edit"],"status":"passed","duration":2567}
```

### Analysis with jq

```bash
# Calculate average duration
cat results.jsonl | jq -s 'map(.duration) | add / length'

# Count tool usage
cat results.jsonl | jq -s 'map(.toolCalls) | flatten | group_by(.) | map({tool: .[0], count: length})'

# Filter by status
cat results.jsonl | jq 'select(.status == "failed")'

# Pass rate
cat results.jsonl | jq -s 'map(select(.status == "passed")) | length as $p | length as $t | "\($p)/\($t) passed"'
```

## Judge Format (Two-Tier)

Creates two files for LLM-as-judge evaluation with step-level correlation.

```bash
bun scripts/run-harness.ts prompts.jsonl --format judge -o results
# Creates: results.md + results.full.jsonl
```

### Markdown File (`<output>.md`)

Human-readable summary with step IDs and code previews.

**Structure:**

```markdown
## Evaluation Record: <id>

**Input:** <original prompt>

**Trajectory:**
1. [THOUGHT] <truncated content> [->stepId]
2. [TOOL:<name>] -> <status> (<duration>ms) [->stepId]
   File: <path> (<size> chars)
   ```<ext>
   <head lines>

   // ... N lines omitted ...

   <tail lines>
   ```
3. [PLAN] <plan summary> [->stepId]
4. [MESSAGE] <truncated content> [->stepId]

**Output:** <truncated final output>
**Metadata:** category=ui, agent=claude-code-acp, ...
**Status:** passed|failed|error|timeout
**Duration:** <ms>ms

---
```

**Step ID Format:** `<prompt-id>-step-<N>` (e.g., `test-001-step-2`)

**Truncation Rules:**
- Thought/message content: First 100 characters
- Output: First 200 characters
- Code preview: Head (8 lines) + tail (4 lines) for files > 12 lines

### Full JSONL File (`<output>.full.jsonl`)

Complete trajectory with step IDs for correlation.

**Schema:**

```typescript
type FullResult = {
  id: string
  input: string
  output: string
  expected?: string
  trajectory: IndexedStep[]     // Steps with stepId
  metadata: Record<string, unknown>
  timing: {
    start: number               // Unix timestamp (ms)
    end: number                 // Unix timestamp (ms)
    firstResponse?: number      // Time to first response (ms)
  }
  status: 'passed' | 'failed' | 'error' | 'timeout'
  errors?: string[]
}

type IndexedStep = TrajectoryStep & { stepId: string }

type TrajectoryStep =
  | { type: 'thought'; content: string; timestamp: number }
  | { type: 'message'; content: string; timestamp: number }
  | {
      type: 'tool_call'
      name: string              // Tool title from ACP SDK
      status: string            // pending, in_progress, completed, failed
      input?: unknown           // Raw input parameters
      output?: unknown          // Raw output
      duration?: number         // Execution time (ms)
      timestamp: number
    }
  | { type: 'plan'; entries: PlanEntry[]; timestamp: number }
```

**Example:**

```jsonl
{"id":"test-001","input":"Create a primary button","output":"I created the button...","trajectory":[{"type":"thought","content":"I'll create a styled button template with createStyles","timestamp":100,"stepId":"test-001-step-1"},{"type":"tool_call","name":"Write","status":"completed","input":{"file_path":"src/button.tsx","content":"import { createStyles }..."},"output":"File written successfully","duration":234,"timestamp":150,"stepId":"test-001-step-2"},{"type":"message","content":"I created the button template","timestamp":500,"stepId":"test-001-step-3"}],"metadata":{"category":"ui","agent":"claude"},"timing":{"start":1704067200000,"end":1704067201234,"firstResponse":100},"status":"passed"}
```

## Two-Tier Evaluation Workflow

### Direct Evaluation (Large Context)

For judges with large context windows (Gemini 1M+, Claude 200k):

```bash
# Feed full JSONL directly
cat results.full.jsonl | your-gemini-judge.ts
```

### Step-Level Retrieval (Small Context)

For smaller models or step-specific analysis:

```typescript
// Load both files
const markdown = await Bun.file('results.md').text()
const fullLines = (await Bun.file('results.full.jsonl').text()).trim().split('\n')

// Parse full results indexed by step ID
const stepIndex = new Map<string, unknown>()
for (const line of fullLines) {
  const result = JSON.parse(line)
  for (const step of result.trajectory) {
    stepIndex.set(step.stepId, step)
  }
}

// Judge requests full content for specific step
const stepId = 'test-001-step-2'  // From markdown [->stepId]
const fullStep = stepIndex.get(stepId)
console.log(fullStep.input)  // Complete tool input
```

## Status Values

| Status | Meaning |
|--------|---------|
| `passed` | Completed without tool errors |
| `failed` | Completed but one or more tool calls failed |
| `error` | Unhandled exception during execution |
| `timeout` | Request exceeded timeout limit |

## Input Format

Both formats accept the same JSONL input:

```jsonl
{"id":"test-001","input":"Create a primary button","expected":"should contain <button>","metadata":{"category":"ui"}}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier |
| `input` | Yes | Prompt text for the agent |
| `expected` | No | Expected output (for downstream scoring) |
| `metadata` | No | Tags, category, difficulty for filtering |
| `timeout` | No | Override default timeout for this prompt |

## Streaming Behavior

Both formats stream output line-by-line as results complete:

```bash
# Watch results in real-time
bun scripts/run-harness.ts prompts.jsonl --progress -o results.jsonl &
tail -f results.jsonl
```

Use `--append` to continue interrupted runs without overwriting previous results.
