# Discovery Workflow

How to discover existing project patterns before generating new elements.

## Step 1: Find Stories

Use code-query to discover project stories:

```bash
# Find all stories in project
bun query-stories.ts src/

# Find stories in specific directory
bun query-stories.ts src/components/
```

This returns story metadata including file paths and export names.

## Step 2: Identify File Types

Look for these file patterns in the project:

| Pattern | Purpose |
|---------|---------|
| `*.tokens.ts` | Design tokens (createTokens) |
| `*.css.ts` | Styles (createStyles, createHostStyles) |
| `*.stories.tsx` | Story tests |
| `*.ts` (with bElement) | Behavioral elements |

```bash
# Find token files
find src/ -name "*.tokens.ts"

# Find style files
find src/ -name "*.css.ts"
```

## Step 3: Analyze bElement Patterns

When reading bElement files, note:

1. **Tag naming convention** - How are custom element tags named?
2. **File organization** - Are tokens/styles in separate files?
3. **Shadow DOM structure** - Common template patterns
4. **Event handling** - p-trigger patterns used
5. **State management** - Custom states with internals.states

## Step 4: Map Token Usage

Identify how tokens are used:

```typescript
// Token definition
export const { fills } = createTokens('fills', { ... })

// Usage in styles
import { fills } from './fills.tokens.ts'
export const styles = createStyles({
  element: { backgroundColor: fills.fill }
})

// Usage in hostStyles
export const hostStyles = joinStyles(fills, createHostStyles({ ... }))
```

## Step 5: Document Findings

Create a mental map of:
- Naming conventions (kebab-case for tags, PascalCase for exports)
- File structure (tokens → styles → element → stories)
- Common patterns (form-associated, decorator, stateful)
- Reusable tokens and styles

## Example Discovery

```
Project Structure:
src/components/
  toggle-input/
    toggle-input.tokens.ts   # Tokens: fills, strokes
    toggle-input.css.ts      # Styles: styles, hostStyles
    toggle-input.ts          # bElement definition
    toggle-input.stories.tsx # Story tests

Patterns Found:
- Uses createTokens with $compoundSelectors for states
- hostStyles uses joinStyles to include token CSS
- Form-associated pattern for form integration
- Play functions test accessibility
```
