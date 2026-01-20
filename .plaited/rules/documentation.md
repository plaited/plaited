# Documentation Standards

## TSDoc Requirements

Public APIs require comprehensive TSDoc documentation following these conventions:

- **No `@example` sections** - Tests serve as living examples
- **Use `@internal` marker** - Mark non-public APIs explicitly
- **Always use `type`** - Prefer type aliases over interfaces

### TSDoc Template

```typescript
/**
 * Brief description of what this does
 *
 * @remarks
 * Additional context, usage notes, or implementation details.
 *
 * @param options - Description of the parameter
 * @returns Description of return value
 *
 * @public
 */
```

## Diagrams

Use Mermaid diagrams only (not ASCII art):

```markdown
\```mermaid
flowchart TD
    A[Start] --> B[Process]
    B --> C[End]
\```
```

**Avoid**: ASCII box-drawing characters (`┌`, `│`, `└`, `─`, etc.)

**Rationale:** Token efficiency, clearer semantic meaning, easier maintenance.
