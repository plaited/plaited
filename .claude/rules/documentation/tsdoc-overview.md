# Agent TSDoc Generation Workflow

When creating or updating TSDoc comments, follow this systematic exploration process:

## Phase 1: Type & Interface Analysis

1. **Identify the target** (function, type, class, or module)
2. **Analyze type signatures:**
   - Parameter types and constraints
   - Return types
   - Generic type parameters
   - Type relationships and dependencies
3. **Trace type dependencies:**
   - What types does this depend on?
   - What types depend on this?
   - Are there related utility types?

## Phase 2: Usage Reference Discovery

1. **Find all usage locations:**
   - Search codebase for imports and references
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
2. **Apply appropriate TSDoc template** (see TSDoc Format Guidelines below)
3. **Cross-reference related APIs** using `@see` tags
4. **Document discovered constraints** in `@remarks`
5. **Note performance characteristics** if evident from usage
6. **Identify limitations** found in tests or usage patterns

## Detailed Templates

For detailed TSDoc format templates, see the code-documentation skill:
- @.claude/skills/code-documentation/SKILL.md
- @.claude/skills/code-documentation/public-api-templates.md
- @.claude/skills/code-documentation/internal-templates.md
- @.claude/skills/code-documentation/type-documentation.md
