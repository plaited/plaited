# Plaited Skills

AI-assisted development skills for the Plaited framework. Provides comprehensive knowledge of behavioral programming patterns, template creation, type verification, and documentation standards.

## Available Skills

### 🎯 plaited-framework-patterns (Auto-Invoked)

Automatically activates when working with Plaited templates, behavioral programs, or web platform patterns. Provides deep knowledge of:

- **Behavioral Programming**: Super-step execution model, thread composition, event selection strategies
- **Templates & Styling**: JSX syntax, FunctionalTemplate pattern, CSS-in-JS (atomic styles, design tokens)
- **Custom Elements**: bElement decorator, islands architecture, Shadow DOM, form-associated elements
- **Cross-Island Communication**: Parent-child patterns, signals, actor model, pub/sub coordination
- **Testing**: Story-based testing with Playwright, workshop CLI workflows
- **Web Workers**: bWorker pattern, message passing, thread lifecycle management

### 🔧 typescript-lsp (Auto-Invoked)

TypeScript Language Server integration for type verification and code navigation:

- **Hover**: Get type signatures and TSDoc at any position
- **Symbols**: Find exports and document structure
- **References**: Find all usages of a symbol
- **Analyze**: Batch analysis with multiple operations

### 📝 code-documentation (Auto-Invoked)

TSDoc workflow and templates for documentation:

- Public API templates
- Internal module documentation
- Type documentation patterns
- 4-phase documentation workflow

### 🔍 code-query (Auto-Invoked)

Story and template discovery for the workshop:

- Find stories by pattern or component
- Generate preview URLs
- Discover behavioral elements

## Usage

Skills activate automatically based on context. Claude uses them when:

- Working with Plaited templates, behavioral programs, or custom elements
- Checking type signatures or finding symbol references
- Writing or reviewing TSDoc documentation
- Discovering stories or testing patterns

**No commands needed** - Claude automatically uses the relevant skill knowledge.

### Workshop CLI Commands

```bash
# Testing
bun plaited test                 # Run all story tests
bun plaited test <path>          # Run tests from directory/file
bun plaited test -p 3500         # Custom port

# Development
bun plaited dev                  # Start dev server
bun --hot plaited dev            # Dev server with hot reload
```

## Directory Structure

```
.claude/
├── skills/
│   ├── plaited-framework-patterns/         # Framework knowledge
│   │   ├── SKILL.md
│   │   ├── references/           # Pattern documentation
│   │   │   ├── behavioral-programs.md
│   │   │   ├── b-element.md
│   │   │   ├── styling.md
│   │   │   ├── stories.md
│   │   │   └── ...
│   │   └── examples/             # Working code examples
│   ├── typescript-lsp/           # Type verification
│   │   ├── SKILL.md
│   │   └── scripts/              # LSP client scripts
│   ├── code-documentation/       # TSDoc templates
│   │   ├── SKILL.md
│   │   └── references/
│   └── code-query/               # Story discovery
│       └── SKILL.md
├── agents/                       # Specialized agents
│   ├── architecture-reviewer.md
│   └── documentation-cleanup.md
├── rules/                        # Project-specific rules
│   ├── development/
│   ├── documentation/
│   └── standards/
└── hooks/                        # User prompt hooks
```

## Why Skills?

Skills use **progressive disclosure** for token efficiency:
- ~100 tokens loaded initially (just metadata)
- Full content (~5k tokens) loads only when relevant
- Comprehensive knowledge without bloating context window
