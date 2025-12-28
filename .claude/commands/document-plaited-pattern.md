---
description: Interactive documentation helper for extracting Plaited framework patterns
allowed-tools: Read, Grep, Glob, AskUserQuestion, Write
---

# Document Plaited Pattern

Extract and document Plaited framework patterns through interactive Q&A with the framework author.

**Target Pattern:** $ARGUMENTS (e.g., "css-in-js", "signals", "behavioral-programs", "b-element")

**Output File:** `plugins/workshop/.claude/rules/plaited/[pattern-name].md`

## Instructions

This command helps Claude accurately document Plaited framework patterns by working interactively with the framework author to refine understanding.

All documentation sections will be written to: `plugins/workshop/.claude/rules/plaited/$ARGUMENTS.md`

### Process

#### Phase 1: Discovery & File Loading

Based on pattern name, identify and read relevant source files:

**Pattern: css-in-js**
- Core: `src/main/create-styles.ts`, `src/main/css.types.ts`
- Integration: `src/main/b-element.utils.ts`, `src/main/create-template.ts`
- Features: `src/main/create-keyframes.ts`, `src/main/create-host-styles.ts`, `src/main/ssr.ts`
- Tests: `src/main/tests/css.spec.tsx`, `src/main/tests/dynamic-styles.stories.tsx`

**Pattern: signals**
- Core: `src/main/use-signal.ts`, `src/main/use-computed.ts`
- Types: `src/main/types.ts` (PlaitedTrigger, FeedbackHandler)
- Tests: `src/main/tests/use-signal.spec.ts`, `src/main/tests/use-computed.spec.ts`

**Pattern: behavioral-programs**
- Core: `src/main/behavioral.ts`, `src/main/b-thread.ts`, `src/main/b-sync.ts`
- Higher-level: `src/main/use-behavioral.ts`
- Integration: `src/main/b-element.ts` (bProgram usage)
- Tests: `src/main/tests/behavioral.spec.ts`, `src/main/tests/*.stories.tsx`

**Pattern: b-element**
- Core: `src/main/b-element.ts`, `src/main/b-element.utils.ts`
- Templates: `src/main/create-template.ts`, `src/main/types.ts`
- Tests: `src/main/tests/*.stories.tsx`

**Pattern: templates**
- Core: `src/main/create-template.ts`, `src/main/types.ts`
- SSR: `src/main/ssr.ts`
- Integration: `src/main/b-element.ts`
- Tests: `src/main/tests/*.spec.tsx`

**IMPORTANT**: These file lists are initial guesses. User will provide feedback to correct and refine them.

#### Phase 2: Show Initial Understanding

After reading files, present findings:
1. **Pattern Overview**: High-level description of what this pattern does
2. **Key APIs**: Main functions/types discovered
3. **File Map**: Which files contain what (ask for corrections)
4. **Initial Questions**: Clarifications needed about confusing code or patterns

Ask user: "Is this understanding correct? What should I focus on or correct?"

#### Phase 3: Diagram Discussion

For complex patterns, ask if visual diagrams would help:
- **Flowchart**: Process flows (style hoisting, SSR, event selection)
- **Sequence Diagram**: Event sequences (BP lifecycle, signal pub/sub)
- **Architecture Diagram**: Module relationships
- **State Machine**: Lifecycle states

Present: "I see [specific complex flow]. Would a [diagram type] help visualize this?"

Let user decide if diagram adds value.

#### Phase 4: Structure Proposal

Propose documentation outline based on pattern type:

**For API-focused patterns (signals, css-in-js, templates):**
```markdown
# [Pattern Name]

## Overview
[What it does, why it exists]

## Core Concepts
[Key principles and mental models]

## API Reference
[Main functions with parameters and return types]

## Usage Patterns
[Common use cases with code snippets]

## Integration with Other Features
[How it connects to rest of framework]

## Common Patterns
[Real-world examples from test files]

## Common Pitfalls
[What to avoid, constraints]
```

**For architectural patterns (behavioral-programs, b-element):**
```markdown
# [Pattern Name]

## Conceptual Overview
[The paradigm/architecture this enables]

## Key Architectural Principles
[Core ideas that guide usage]

## Behavioral Element Lifecycle
[How it works from creation to cleanup]

## API Reference
[Main functions and their roles]

## Patterns and Examples
[Common usage patterns]

## Integration Points
[How it composes with other features]

## Advanced Topics
[Edge cases, performance, internals]
```

Ask: "Does this structure work for [pattern name]? What sections are missing or unnecessary?"

#### Phase 5: Section-by-Section Drafting

For each section:
1. **Draft**: Write section content based on code and user feedback
2. **Present**: Show draft with code references (file:line format)
3. **Ask**: "Is this accurate? What needs correction or clarification?"
4. **Refine**: Incorporate feedback immediately
5. **Confirm**: "Is this section complete? Ready for next section?"
6. **Iterate**: Move to next section

**CRITICAL**: Work ONE section at a time. Don't draft entire document at once.

#### Phase 6: Diagram Creation (if applicable)

If user agreed diagram would help:
1. Draft mermaid diagram code
2. Present to user
3. Ask: "Does this accurately represent [flow/architecture/sequence]?"
4. Refine based on feedback
5. Include in appropriate documentation section

#### Phase 7: Final Review

1. Present complete documentation
2. Ask: "Any final corrections, additions, or refinements?"
3. Incorporate final feedback
4. Write to `plugins/workshop/.claude/rules/plaited/[pattern-name].md`

## Output Location

Documentation saved to: `plugins/workshop/.claude/rules/plaited/[pattern-name].md`

## Example Usage

```bash
/document-plaited-pattern css-in-js
/document-plaited-pattern signals
/document-plaited-pattern behavioral-programs
/document-plaited-pattern b-element
/document-plaited-pattern templates
```

## Key Principles

1. **User is the expert**: Always trust user corrections over code interpretation
2. **Show your work**: Present code findings with file references for validation
3. **Ask focused questions**: One topic at a time, not comprehensive lists
4. **Iterate incrementally**: Section-by-section, not all at once
5. **Verify continuously**: Check understanding at each phase before proceeding
6. **Read code first**: Always base questions on actual implementation, not assumptions
7. **Use diagrams selectively**: Only when complex flows benefit from visualization
8. **File lists are guesses**: Expect user to correct and refine relevant files

## Anti-Patterns to Avoid

❌ Drafting entire document without feedback
❌ Asking too many questions at once
❌ Making assumptions without showing code evidence
❌ Creating diagrams without user agreement they'd be helpful
❌ Treating initial file list as complete/correct
❌ Moving to next section before current section is validated
