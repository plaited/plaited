# LSP-Based Type Verification

**CRITICAL**: Use LSP to verify Plaited framework types before generating code.

Use the **typescript-lsp** skill for LSP tools. This document focuses on Plaited-specific verification patterns.

## When to Use LSP

1. **Before using Plaited APIs**: Hover over `bElement`, `createStyles`, `bProgram` to verify current signatures
2. **After generating code**: Check for type errors
3. **For callback types**: Verify `BehavioralElementCallbackDetails` structure
4. **For CSS-in-JS**: Confirm `createStyles`, `createHostStyles`, `createTokens` signatures
5. **For BProgramArgs**: Understand what's available in bProgram context

## LSP Operations

Use the typescript-lsp skill scripts:

```bash
# Get type info at position (0-indexed line:char)
bun .claude/skills/typescript-lsp/scripts/lsp-hover.ts <file> <line> <char>

# List all symbols in a file
bun .claude/skills/typescript-lsp/scripts/lsp-symbols.ts <file>

# Find all references
bun .claude/skills/typescript-lsp/scripts/lsp-references.ts <file> <line> <char>

# Search workspace for symbols
bun .claude/skills/typescript-lsp/scripts/lsp-find.ts <query>

# Batch analysis
bun .claude/skills/typescript-lsp/scripts/lsp-analyze.ts <file> --exports
```

### `hover`
Get type information for Plaited imports at a specific line:character position:
```typescript
// Hover on 'bElement' at line 1, character 10
import { bElement } from 'plaited'
//         ^
// Returns: function signature, parameters, JSDoc
```

### `definition`
Navigate to Plaited API source to understand implementation:
- See actual parameter types in source
- Understand return type structure
- Read implementation TSDoc

### `references`
See usage patterns in real code:
- How is this API used elsewhere?
- What patterns exist in the codebase?
- Common parameter values?

### `symbols`
Explore available APIs in modules:
- What exports are available from 'plaited'?
- What methods exist on a type?

## Example Workflow

### Scenario: User asks to create bElement with form association

**Step 1: Verify bElement signature**
```bash
# Find bElement export and check its type
bun .claude/skills/typescript-lsp/scripts/lsp-analyze.ts src/main/b-element.ts --exports
bun .claude/skills/typescript-lsp/scripts/lsp-hover.ts src/main/b-element.ts 139 13
```

**Step 2: Verify BProgramArgs**
```bash
# Check BProgramArgs type to see available properties
bun .claude/skills/typescript-lsp/scripts/lsp-find.ts BProgramArgs
# Then hover on the result to see: $, root, host, internals, trigger, emit, etc.
```

**Step 3: Verify callback types**
```bash
# Find BehavioralElementCallbackDetails
bun .claude/skills/typescript-lsp/scripts/lsp-find.ts BehavioralElementCallbackDetails
# Shows all lifecycle callback signatures
```

**Step 4: Generate code with confidence**
```typescript
export const MyInput = bElement({
  tag: 'my-input',
  formAssociated: true,
  bProgram({ internals, trigger }) {  // Types verified via LSP
    return {
      onConnected() {
        // internals signature verified
        internals.setFormValue('initial')
      }
    }
  }
})
```

**Step 5: Verify generated code**
```bash
# After writing the file, verify the setFormValue call
bun .claude/skills/typescript-lsp/scripts/lsp-hover.ts path/to/my-input.ts <line> <char>
# Confirms: setFormValue(value: File | string | FormData | null)
```

## Critical Files to Verify

### Core Types
- `src/main/b-element.types.ts` - BehavioralElement, BProgramArgs, callback types
- `src/main/css.types.ts` - CSS-in-JS type signatures
- `src/main/behavioral.types.ts` - Behavioral programming types
- `src/main/create-template.types.ts` - Template types

### Common Verifications

**BProgramArgs properties:**
```typescript
// Hover to verify what's available:
bProgram({ $, root, host, internals, trigger, emit, bThreads, bThread, bSync, inspector }) {
  // LSP confirms all parameter types
}
```

**Helper methods on BoundElement:**
```typescript
// Hover to verify available methods:
const element = $('target')[0]
element?.render(/* ... */)   // LSP shows signature
element?.insert(/* ... */)   // LSP shows signature
element?.attr(/* ... */)     // LSP shows signature
element?.replace(/* ... */)  // LSP shows signature
```

**Lifecycle callbacks:**
```typescript
// Hover to verify callback signatures:
return {
  onConnected() {},                           // void
  onDisconnected() {},                        // void
  onAttributeChanged({ name, oldValue, newValue }) {},  // detail type
  onFormAssociated(form: HTMLFormElement) {},          // detail type
}
```

## Integration with Code Generation

### Before Generation
1. **LSP hover** on API imports to understand signatures
2. **LSP goToDefinition** to read TSDoc and implementation
3. **LSP findReferences** to see real usage patterns

### During Generation
1. Use verified types from LSP hover
2. Follow patterns found via findReferences
3. Apply parameter types exactly as shown in hover

### After Generation
1. **LSP hover** on generated function calls to verify
2. Check for type errors in generated code
3. Confirm signatures match expectations

## Common LSP Checks

### Check 1: What's in BProgramArgs?
```typescript
// LSP hover on BProgramArgs to see all available properties
bProgram(args: BProgramArgs) {
  // Hover shows: $, root, host, internals, trigger, etc.
}
```

### Check 2: What callbacks are available?
```typescript
// LSP hover on BehavioralElementCallbackDetails
// Shows: onConnected, onDisconnected, onAttributeChanged, etc.
```

### Check 3: What helper methods exist?
```typescript
// LSP hover on element after $ query
const el = $('target')[0]
// Hover on 'el' shows BoundElement<T> with render, insert, attr, replace
```

### Check 4: Verify ElementInternals methods
```typescript
// LSP hover on internals property
bProgram({ internals }) {
  // Hover shows ElementInternals with setFormValue, states, etc.
}
```

## Confidence Threshold

Use LSP to achieve **95% confidence** (per accuracy.md):
- Types match current implementation ✓
- Function signatures are accurate ✓
- Parameter names match source ✓
- Return types are correct ✓

Only generate code after LSP verification confirms accuracy.
