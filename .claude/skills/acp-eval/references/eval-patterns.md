# Evaluation Patterns

Guidelines for creating effective agent evaluations using the ACP evaluation harness.

## Intent Design

### Good Intents

Effective evaluation intents are **specific, action-oriented, and measurable**:

| Good Intent | Why It Works |
|-------------|--------------|
| "Create a primary button with hover state" | Specific outcome, testable result |
| "Read the package.json and list dependencies" | Clear action, verifiable output |
| "Fix the TypeScript error in src/utils.ts" | Defined goal, checkable completion |
| "Add form validation for email input" | Functional requirement, testable |

### Bad Intents

Avoid vague or unmeasurable intents:

| Bad Intent | Problem |
|------------|---------|
| "Make it better" | No defined criteria |
| "Help me with code" | Too broad, no specific goal |
| "Do something useful" | Unmeasurable outcome |
| "Fix bugs" | Which bugs? How to verify? |

### Intent Templates

Use these patterns for consistent evaluations:

```
# Creation
"Create a [thing] with [specific feature]"
"Build a [thing] that [specific behavior]"

# Modification
"Update [file/thing] to [specific change]"
"Refactor [code] to use [pattern/approach]"

# Analysis
"Read [file] and [specific extraction]"
"Find all [pattern] in [scope]"

# Fixing
"Fix the [specific error] in [location]"
"Resolve the [issue type] by [approach]"
```

## Evaluation Categories

### Functional Accuracy

Tests whether the agent accomplishes the intended task:

```typescript
const evalCase: EvalCase = {
  id: 'func-button-1',
  intent: 'Create a button that triggers an alert on click',
  expectedTools: ['Write', 'Read'],
  tags: ['functional', 'creation']
}
```

**Scoring criteria:**
- Did the agent create the requested artifact?
- Does the artifact function correctly?
- Were appropriate tools used?

### Code Quality

Tests the quality of generated code:

```typescript
const evalCase: EvalCase = {
  id: 'quality-types-1',
  intent: 'Add TypeScript types to the utils.ts file',
  tags: ['quality', 'typescript']
}
```

**Scoring criteria:**
- Does code pass type checking?
- Are best practices followed?
- Is the code maintainable?

### Tool Usage Efficiency

Tests efficient use of available tools:

```typescript
const evalCase: EvalCase = {
  id: 'efficiency-read-1',
  intent: 'Find all TODO comments in src/',
  expectedTools: ['Grep'],
  tags: ['efficiency', 'search']
}
```

**Scoring criteria:**
- Were minimal tools used?
- Was the right tool chosen?
- Was tool usage sequential vs parallel?

### Error Handling

Tests agent behavior on invalid or edge-case inputs:

```typescript
const evalCase: EvalCase = {
  id: 'error-missing-1',
  intent: 'Read the file at /nonexistent/path.ts',
  tags: ['error-handling', 'edge-case']
}
```

**Scoring criteria:**
- Did the agent handle the error gracefully?
- Was an appropriate explanation provided?
- Did it suggest alternatives?

## Suite Organization

### By Difficulty

Organize evaluations by complexity:

```
evals/
├── simple/           # Single-step tasks
│   ├── read.jsonl
│   └── write.jsonl
├── moderate/         # Multi-step tasks
│   ├── refactor.jsonl
│   └── feature.jsonl
└── complex/          # Multi-file, architectural
    ├── migration.jsonl
    └── integration.jsonl
```

### By Domain

Organize by task type:

```
evals/
├── ui/               # UI generation
├── testing/          # Test writing
├── debugging/        # Bug fixing
└── docs/             # Documentation
```

### By Target

Organize by evaluation target:

```
evals/
├── agent/            # Base agent capability
├── skills/           # Skill-specific evals
│   ├── world-agent.jsonl
│   └── workbench.jsonl
└── mcp/              # MCP server integration
```

## Scoring Strategies

### Binary Pass/Fail

Simple pass/fail based on completion:

```typescript
const score = result.status === 'passed' ? 1.0 : 0.0
```

### Weighted Metrics

Combine multiple factors:

```typescript
const score =
  (accuracy * 0.4) +
  (toolEfficiency * 0.3) +
  (latency < threshold ? 0.2 : 0) +
  (noErrors ? 0.1 : 0)
```

### Relative Scoring

Compare against baseline:

```typescript
const relativeScore = agentScore / baselineScore
```

## Common Pitfalls

### Over-Specific Expectations

❌ **Bad:** Expecting exact file content match
```typescript
// Too brittle
expectedOutput: 'const x = 1;'
```

✅ **Good:** Check for key patterns
```typescript
// Flexible validation
validate: (output) => output.includes('const') && output.includes('= 1')
```

### Ignoring Context

❌ **Bad:** Testing without proper project setup
```typescript
// Agent can't find dependencies
intent: 'Add a React component'
cwd: '/empty/directory'
```

✅ **Good:** Provide realistic context
```typescript
intent: 'Add a React component'
cwd: '/project/with/package.json'
```

### Timeout Too Short

❌ **Bad:** Insufficient time for complex tasks
```typescript
timeout: 5000  // 5 seconds for multi-file changes
```

✅ **Good:** Scale timeout to task complexity
```typescript
timeout: 120000  // 2 minutes for complex tasks
```

## Baseline Comparison

When comparing agents, ensure fair evaluation:

1. **Same environment** - Identical working directory and files
2. **Same prompts** - Use identical intent phrasing
3. **Same tools** - Equal tool access (or document differences)
4. **Same timeout** - Equal time limits

```bash
# Fair comparison setup
bun scripts/run-eval.ts suite.jsonl --agent "claude code" -o baseline/
bun scripts/run-eval.ts suite.jsonl --agent "trained-agent" -o trained/
bun scripts/compare-baseline.ts baseline/ trained/
```

## Continuous Evaluation

### Regression Testing

Run evals on model updates:

```bash
# After model update
bun scripts/run-eval.ts regression-suite.jsonl --agent "updated-model"
bun scripts/score-eval.ts results/ --compare previous-results/
```

### Performance Monitoring

Track metrics over time:

```typescript
// Log metrics to time series
const metrics = {
  timestamp: Date.now(),
  accuracy: summary.accuracy,
  avgLatency: summary.avgLatency,
  errorRate: summary.errorRate
}
appendToMetricsLog(metrics)
```
