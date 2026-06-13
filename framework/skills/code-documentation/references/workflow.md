# TSDoc Generation Workflow

When creating or updating TSDoc comments, follow this systematic exploration process.

**Prerequisite**: Use the **typescript-lsp** skill for type verification throughout this workflow. The `lsp` tool provides accurate type information directly from the TypeScript compiler via a unified JSON interface.
For larger maintenance passes, start with `bun skills/code-documentation/scripts/run.ts` to inventory missing docs and orphaned blocks before choosing targets.

## Phase 1: Type & Interface Analysis

1. **Identify the target** (function, type, class, or module)
2. **Analyze type signatures** using the `lsp` tool:
   - Run `lsp` with a `symbols` operation to get file structure overview
   - Run `lsp` with a `hover` operation on the target to get exact type signatures
   - Parameter types and constraints
   - Return types
   - Generic type parameters
   - Type relationships and dependencies
3. **Trace type dependencies:**
   - Run `lsp` with a `references` operation to find what depends on this type
   - What types does this depend on?
   - What types depend on this?
   - Are there related utility types?

## Phase 2: Usage Reference Discovery

1. **Find all usage locations** using the `lsp` tool:
   - Run `lsp` with a `references` operation on the target symbol
   - Run `lsp` with a `find` operation to search for related patterns
   - Identify calling patterns
   - Note common usage contexts
2. **Analyze integration points:**
   - How is this used in the architecture?
   - What modules consume this?
   - What are the typical call chains?

## Phase 3: Test & Story Analysis

1. **Review test files** (`.test.ts`, `.spec.ts`):
   - What behaviors are tested?
   - What edge cases are covered?
   - What scenarios are validated?
2. **Review story files** (`.stories.tsx`):
   - How is this used in practice?
   - What real-world scenarios exist?
   - What configurations are demonstrated?

## Phase 4: Documentation Generation

1. **Synthesize findings** from phases 1-3
2. **Apply appropriate TSDoc template** from this skill
3. **Cross-reference related APIs** using `@see` tags
4. **Document discovered constraints** in `@remarks`
5. **Note performance characteristics** if evident from usage
6. **Identify limitations** found in tests or usage patterns

## Templates

After completing the workflow phases, apply the appropriate template:
- @public-api-templates.md - Public-facing APIs
- @internal-templates.md - Internal code and modules
- @type-documentation.md - Type documentation
