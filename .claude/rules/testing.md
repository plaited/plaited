# Testing

Plaited uses Bun's built-in test runner for unit and integration tests, and a custom workshop CLI for browser-based template tests.

## Test Types

### Unit/Integration Tests (`*.spec.{ts,tsx}`)

- Standard Bun tests using `*.spec.ts` or `*.spec.tsx` extensions
- Run with `bun test` command
- Used for testing business logic, utilities, behavioral programs, and non-visual functionality
- No browser or DOM dependencies required

### Template/Browser Tests (`*.stories.tsx`)

- Browser-based tests using Playwright integration via the workshop CLI
- Use `*.stories.tsx` extension
- Run with the workshop CLI at `src/workshop/cli.ts`
- Test visual templates, user interactions, and accessibility
- Powered by `story` helper from `plaited/testing`

## Running Tests

```bash
# Run all tests (story tests on src/main + unit tests) - used in CI
bun run test

# Run only unit/integration tests
bun test

# Run story tests for specific path(s)
bun run test:stories src/main

# Run story tests for entire project
bun run test:stories

# Start dev server with hot reload for manual testing
bun run dev

# Run story tests with custom port
bun run test:stories -p 3500
```

## Running Specific Test Files

```bash
# Run a specific spec test file
bun test path/to/file.spec.ts

# Run tests matching a pattern
bun test pattern

# Run story tests for a specific directory
bun run test:stories path/to/directory
```

## Test File Naming Conventions

- **`*.spec.ts` or `*.spec.tsx`**: Unit/integration tests run with Bun
- **`*.stories.tsx`**: Template/browser tests run with workshop CLI

## Test Style Conventions

### Use `test` Instead of `it`

Use `test` instead of `it` in test files for consistency:

```typescript
// ✅ Good
test('should render button correctly', () => {
  // ...
})

// ❌ Avoid
it('should render button correctly', () => {
  // ...
})
```

## Skill Script Tests

Claude Code skills in `.claude/skills/` may include executable scripts. Tests for these scripts follow a specific structure:

### Directory Structure

```
.claude/skills/<skill-name>/
├── SKILL.md
├── scripts/
│   ├── script-name.ts        # Executable script
│   └── tests/
│       └── script-name.spec.ts  # Tests for the script
```

### Running Skill Script Tests

```bash
# From skill directory
bun test scripts/tests/
```

### Test Pattern

Scripts that output JSON can be tested using Bun's shell API:

```typescript
import { describe, test, expect } from 'bun:test'
import { join } from 'node:path'
import { $ } from 'bun'

const scriptsDir = join(import.meta.dir, '..')

describe('script-name', () => {
  test('outputs expected JSON', async () => {
    const result = await $`bun ${scriptsDir}/script-name.ts arg1 arg2`.json()
    expect(result.filePath).toEndWith('expected.ts')
  })

  test('exits with error on invalid input', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/script-name.ts`], {
      stderr: 'pipe',
    })
    const exitCode = await proc.exited
    expect(exitCode).toBe(1)
  })
})
```

## Anti-Patterns

### No Conditionals Around Assertions

Never wrap assertions in conditionals. Tests should fail explicitly, not silently skip assertions.

```typescript
// ❌ WRONG: Conditional assertion
if (result) {
  expect(result.value).toBe(expected)
}

// ❌ WRONG: Optional chaining with assertion
result?.value && expect(result.value).toBe(expected)

// ✅ CORRECT: Assert the condition, then assert the value
expect(result).toBeDefined()
expect(result.value).toBe(expected)

// ✅ CORRECT: Use type narrowing assertion
expect(result).not.toBeNull()
expect(result!.value).toBe(expected)
```

If a value might not exist, the test should either:
1. Assert that it exists first, then check its value
2. Assert that it doesn't exist (if that's the expected behavior)
3. Restructure the test to ensure the value is always present
