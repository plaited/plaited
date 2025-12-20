# Import Path Standards

**IMPORTANT**: Use package imports instead of relative paths in test files and fixtures for better maintainability.

## In Test Files and Fixtures

- ✅ Use `'plaited'` for main module imports
- ✅ Use `'plaited/testing'` for testing utilities
- ✅ Use `'plaited/utils'` for utility functions
- ❌ Avoid relative paths like `'../../../../main.ts'` or `'../../utils.ts'`

## Examples

```typescript
// ✅ Good: Package imports in test files
import { bElement, type FT } from 'plaited'
import { story } from 'plaited/testing'
import { wait, noop } from 'plaited/utils'

// ❌ Avoid: Relative paths in test files
import { bElement, type FT } from '../../../../main.ts'
import { story } from '../../../../../testing/testing.fixture.tsx'
import { wait, noop } from '../../utils.ts'
```

## When to Use Relative Imports

- Within the same module/directory for local dependencies
- Test fixtures importing other fixtures in the same test directory
- Shared test utilities within the test directory

## Rationale

Package imports are cleaner, resilient to directory restructuring, and match how consumers will import from the published package.
