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

# Run only template/browser tests (via package.json script)
bun run test:stories

# Run test for specific file(s)/paths(s)
bun run test:story src/main/tests/component-comms.stories.tsx

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
