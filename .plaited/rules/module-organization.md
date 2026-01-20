# Module Organization

## No Index Files

**Never use `index.ts` or `index.js` files.** These create implicit magic and complicate debugging.

### Re-export Pattern

Use named re-export files at the parent level, matching the folder name:

```
src/
├── acp/                 # Feature module
│   ├── acp.types.ts
│   ├── acp.schemas.ts
│   └── acp.ts           # Main implementation
├── acp.ts               # Re-exports public API from acp/
├── utils/
│   └── format.ts
└── utils.ts             # Re-exports public API from utils/
```

### Single Feature Packages

When a package has one primary feature, expose that re-export file directly as main:

```json
{
  "main": "src/acp.ts",
  "exports": {
    ".": "./src/acp.ts",
    "./utils": "./src/utils.ts"
  }
}
```

Only use `main.ts` if the package truly has multiple co-equal entry points that need a unified export.

## Explicit Import Extensions

Always include `.ts` extensions in imports. Bun runs TypeScript natively—no compilation required:

```typescript
// ✅ Good
import { Config } from './module.types.ts'
import { createClient } from '../acp/acp.ts'

// ❌ Avoid
import { Config } from './module.types'
```

**Rationale:** Explicit extensions enable direct execution, clearer module graphs, and align with ES module standards. With `allowImportingTsExtensions: true`, TypeScript supports this pattern.

## File Organization Within Modules

```
feature/
├── feature.types.ts      # Type definitions only
├── feature.schemas.ts    # Zod schemas + inferred types
├── feature.constants.ts  # Constants, error codes
└── feature.ts            # Main implementation
```

- **Types file**: Type definitions only, no re-exports from siblings
- **Schemas file**: Zod schemas and `z.infer<>` types
- **Constants file**: All constant values
- **Main file**: Primary implementation, named after the feature

### Key Principles

- **Direct imports**: Import from specific files, not through re-exports within a module
- **Re-exports at boundaries**: Only use re-export files to expose public API at module boundaries
- **No circular re-exports**: Types file does NOT re-export from siblings

```typescript
// ✅ Good: Direct imports from specific files
import type { Config } from './feature.types.ts'
import { ConfigSchema } from './feature.schemas.ts'
import { ERROR_CODES } from './feature.constants.ts'

// ❌ Avoid: Expecting one file to re-export everything
import { Config, ConfigSchema, ERROR_CODES } from './feature.types.ts'
```

**Rationale:** Prevents circular dependencies, makes dependencies explicit, improves tree-shaking.
