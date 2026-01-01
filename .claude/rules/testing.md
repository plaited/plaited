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
# Run all tests (both spec tests and story tests)
bun run test

# Run only unit/integration tests
bun test

# Run only template/browser tests (via package.json script) for entire project
bun run test:stories

# Run test for specific file(s)/paths(s)
bun run test:stories src/main

# Start story server in dev mode for manual live preview debugging
bun run dev

# Run template tests with custom port
bun run test:stories -p 3500
```

## Running Specific Test Files

```bash
# Run a specific spec test file
bun test path/to/file.spec.ts

# Run tests matching a pattern
bun test pattern
```

## Test File Naming Conventions

- **`*.spec.ts` or `*.spec.tsx`**: Unit/integration tests run with Bun
- **`*.stories.tsx`**: Template/browser tests run with workshop CLI

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
