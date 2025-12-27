# Plaited Development Standards

Essential standards for generating accurate, idiomatic Plaited code.

## Confidence Threshold

**95% Confidence Required** - Report uncertainty rather than guess.

### Verification Protocol

1. **Verification First**: Before stating any specific implementation detail (function signature, file path, API schema), read the relevant file in real-time to verify accuracy.

2. **Handling Uncertainty**: If you cannot verify information or find contradictions between instructions and live code, you must NOT provide speculative answers.
   - **Action**: Clearly state you cannot answer with high confidence and explain the discrepancy.
   - Example: "I cannot confirm [detail] because my instructions indicate [X], but the current file shows [Y]. My knowledge may be outdated."

3. **Dynamic Exploration**: Use Glob/Grep to find files and Read to verify current implementations. Always prioritize live code over instructions.

4. **Tool-Assisted Verification**:
   - **Framework-First**: Before consulting external sources, verify what the Plaited framework already provides by reading relevant type definition files (e.g., `BProgramArgs`, `BehavioralElementCallbackDetails` in `src/main/b-element.types.ts`).
   - **LSP (Language Server Protocol)**: Use hover, goToDefinition, and findReferences to verify Plaited framework type signatures in real-time before generating code.
   - **WebFetch**: Only after confirming the feature isn't built into the framework, retrieve current documentation from authoritative sources (MDN Web Docs, WHATWG specs) when using web platform APIs.
   - These tools complement (but do not replace) reading live code - always verify tool outputs against actual implementation.

### Certainty Requirements

You may only propose a specific change if you are **at least 95% certain** it is correct, based on direct comparison with current code.

**When uncertain:**
- Report the discrepancy clearly
- State why you cannot confidently recommend a fix
- Present the issue to the user for manual resolution
- DO NOT invent solutions or infer changes

## Documentation Guidelines

### Core Principles

- Public APIs require comprehensive documentation without code examples (tests/stories serve as living examples)
- Internal modules need maintainer-focused documentation
- All documentation should be practical and actionable
- Avoid redundant or obvious comments
- Use `@internal` marker for non-public APIs
- Document the "why" not just the "what"
- **No `@example` sections in TSDoc** - Tests and stories provide living examples
- **Type over interface**: Always prefer `type` declarations
- **Factory functions only**: Never show raw `yield` statements in behavioral documentation
- **Cross-references**: Use `@see` tags to connect related APIs
- **Mermaid diagrams only**: Use mermaid syntax for all diagrams (flowcharts, sequence diagrams, etc.)

### Diagram Guidelines

Always use [mermaid](https://mermaid.js.org/) syntax for diagrams in markdown files:

```markdown
\```mermaid
flowchart TD
    A[Start] --> B[Process]
    B --> C[End]
\```
```

**Benefits**:
- Token efficiency: Mermaid diagrams use significantly fewer tokens than ASCII art
- Structured context: Clearer semantic meaning for AI agents
- Maintainability: Easier to update and modify
- Consistency: Standardized diagram syntax

**Common diagram types**:
- `flowchart TD` - Top-down flowcharts for processes and logic
- `sequenceDiagram` - Interaction diagrams for communication patterns
- `graph LR` - Left-right graphs for relationships

**Line breaks in labels**: Use `<br/>` for multi-line text in node labels

**Avoid**: ASCII box-drawing characters (`┌`, `│`, `└`, `─`, etc.)

## Bun Platform APIs

**IMPORTANT**: Prefer Bun's native APIs over Node.js equivalents when running in Bun environment.

### File System Operations

- ✅ Use `Bun.file(path).exists()` instead of `fs.existsSync()`
- ✅ Use `Bun.file(path)` API for reading/writing files
- ✅ Use `Bun.write()` for efficient file writes

### Shell Commands

- ✅ Use `Bun.$` template literal for shell commands
- ❌ Avoid `child_process.spawn()` or `child_process.exec()`
- Example: `await Bun.$\`npm install\`` instead of spawn('npm', ['install'])

### Path Resolution

- ✅ Use `Bun.resolveSync()` for module resolution
- ✅ Use `import.meta.dir` for current directory
- ⚠️ Keep `node:path` utilities for path manipulation (join, resolve, dirname)

### Package Management

- ✅ Use `Bun.which(cmd)` to check for executables
- ⚠️ No programmatic package manager API yet - use CLI commands via `Bun.$`

### Environment Detection

- ✅ Check `typeof Bun !== 'undefined'` for Bun runtime
- ✅ Use `Bun.which('bun')` to verify bun executable exists

### When to Use Node.js APIs

- Interactive input (readline)
- Complex path manipulation (prefer node:path utilities)
- APIs without Bun equivalents

### Bun Documentation

- Main docs: https://bun.sh/docs
- Shell API: https://bun.sh/docs/runtime/shell
- File I/O: https://bun.sh/docs/api/file-io
- Runtime APIs: https://bun.sh/docs/runtime/bun-apis
