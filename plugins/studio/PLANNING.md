# Studio Plugin - Planning Document

## Overview

A Claude Code plugin providing comprehensive Plaited framework knowledge for AI-assisted development. Delivers behavioral programming patterns, template creation guidance, and web pattern extraction through an auto-invoked skill system.

**Current Status:** Knowledge & Documentation Plugin (v0.1.0)

**Future Vision:** Outcome-based design studio with pattern extraction and MCP integration

## What's Implemented (v0.1.0)

### ✅ Plaited Patterns Skill

**Auto-invoked** when working with Plaited templates, behavioral programs, or web platform patterns.

**Knowledge base covers:**
- **Behavioral Programming**: Super-step execution, thread composition, event selection, rule composition patterns
- **Templates & Styling**: JSX syntax, FunctionalTemplate, CSS-in-JS (createStyles, createHostStyles, tokens, keyframes)
- **Custom Elements**: bElement decorator pattern, islands architecture, form-associated elements
- **Cross-Island Communication**: Parent-child patterns, signals, actor model
- **Testing**: Story-based testing with Playwright integration, workshop CLI
- **Web Workers**: bWorker pattern, message passing, lifecycle management

**Documentation files (with mermaid diagrams):**
- `skills/plaited-patterns/plaited/behavioral-programs.md` - BP foundations
- `skills/plaited-patterns/plaited/b-element.md` - Custom element patterns
- `skills/plaited-patterns/plaited/styling.md` - Templates and CSS-in-JS
- `skills/plaited-patterns/plaited/stories.md` - Testing workflows
- `skills/plaited-patterns/plaited/form-associated-elements.md` - Form integration
- `skills/plaited-patterns/plaited/cross-island-communication.md` - Signal patterns
- `skills/plaited-patterns/plaited/web-workers.md` - Web Worker patterns

### ✅ Extract Web Pattern Skill

**User-invoked** to extract modern HTML/Web API patterns from articles and add to project knowledge.

**Purpose:** Help users build their own pattern library from web articles about:
- Modern HTML features (dialog, popover, invokers, etc.)
- Web APIs (Intersection Observer, Priority Hints, etc.)
- Performance optimization (preconnect, dns-prefetch, fetchpriority)
- Accessibility improvements
- Shadow DOM / Web Templates compatible patterns

**Output:** Creates skill in user's project with extracted pattern knowledge.

**Usage:** User provides URL → Skill extracts pattern → Creates project-local skill

### ✅ SessionStart Hook

**Runs once per session** to provide setup guidance:
- Checks for `typescript-lsp@claude-plugins-official` plugin (recommended for type inference)
- Verifies Bun runtime installation
- Displays workshop CLI command reference

**Workshop CLI commands:**
```bash
bun plaited test                 # Run all story tests
bun plaited test <path>          # Run tests from directory/file
bun plaited test -p 3500         # Custom port
bun plaited test -c dark         # Dark mode
bun plaited dev                  # Start dev server
bun --hot plaited dev            # Dev server with hot reload
```

## Plugin Structure (Current)

```
plugins/studio/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── hooks/
│   ├── hooks.json               # Hook configuration
│   └── SessionStart             # Dependency check + CLI help
├── skills/
│   ├── plaited-patterns/        # Plaited framework knowledge (auto-invoked)
│   │   ├── SKILL.md
│   │   └── plaited/
│   │       ├── behavioral-programs.md
│   │       ├── b-element.md
│   │       ├── styling.md
│   │       ├── stories.md
│   │       ├── form-associated-elements.md
│   │       ├── cross-island-communication.md
│   │       └── web-workers.md
│   └── extract-web-pattern/     # Web pattern extraction (user-invoked)
│       └── SKILL.md
├── PLANNING.md                  # This file
└── README.md                    # User documentation
```

## Design Decisions

### 1. Skills Over Rules for Progressive Disclosure ✅

**Why skills are default:**
- **Token efficiency**: Only ~100 token metadata loads initially
- **Full content loads on-demand**: ~5k tokens only when Claude determines relevance
- **Bundled resources lazy-load**: Only when actually used

**Why rules are for always-on guidance:**
- **Loaded at session start**: Always in context, full token cost paid upfront
- **Best for project-wide standards**: Code style, architecture patterns that apply everywhere

**Decision:** Extract patterns to skills (default), not rules.

### 2. Documentation-First Approach ✅

- **Rationale**: Build comprehensive knowledge base before automation
- **Benefit**: AI has accurate patterns to work from
- **Status**: Complete for core framework patterns

### 3. Mermaid Diagrams Only ✅

- **Rationale**: Token-efficient, better structured context for AI
- **Benefit**: Lower token usage, clearer semantics than ASCII art
- **Standard**: All diagrams use mermaid syntax (flowcharts, sequence diagrams)
- **Status**: All diagrams converted to mermaid format

### 4. TypeScript LSP Integration ✅

- **Rationale**: Accurate type inference from imports
- **Benefit**: Better code generation with real type signatures
- **Status**: Recommended in SessionStart hook, optional dependency

### 5. Bun as Required Runtime ✅

- **Rationale**: Required for entire Plaited framework (not a plugin limitation)
- **Benefit**: Fast test execution, built-in TypeScript, hot reload
- **Status**: Verified in SessionStart hook

### 6. User-Owned Pattern Extraction ✅

- **Rationale**: Patterns should live in user's project, not baked into plugin
- **Benefit**: Project-specific knowledge, user maintains their own library
- **Mechanism**: `extract-web-pattern` skill creates skills in user's `.claude/skills/`
- **Status**: Skill definition complete, ready for use

## Future Roadmap

### Phase 2: Outcome-Based Patterns (Not Started)

**Goal:** Define UI outcome patterns (auth-flow, data-table, form-validation, etc.)

**Approach:** Create skills for common UI patterns that:
- Define user goals and required elements
- Provide BP thread patterns
- Include template scaffolds
- Reference accessibility and web platform constraints

**Example outcomes:**
- Authentication flows (OAuth, magic link, etc.)
- Data tables (sorting, filtering, pagination)
- Form validation (multi-step, real-time feedback)
- Modal dialogs (focus trapping, escape handling)

### Phase 3: Outcome Designer Skill (Not Started)

**Goal:** Auto-generate templates from outcome descriptions

**Flow:**
1. User describes need (e.g., "I need authentication with OAuth")
2. Skill reads outcome pattern knowledge
3. Applies Plaited constraints (BP, signals, Shadow DOM)
4. Generates template + story + behavioral program
5. Validates against framework standards

### Phase 4: MCP Server Integration (Not Started)

**Goal:** Live preview with MCP protocol

**Components:**
- Bun HTTP server serving stories (port 3500)
- MCP protocol handler (StdioServerTransport)
- Workshop discovery integration
- postMessage bridge for interactive preview

**Tools:**
- `generate_template`: Creates template from outcome
- `preview_template`: Returns live preview UI
- `validate_bp_pattern`: Checks BP correctness

**Auto-preview hook:** PostToolUse triggers `bun --hot plaited dev` when `*.stories.tsx` created

### Phase 5: Advanced Features (Future)

- Constraint catalog expansion
- Design system integration
- Multi-pattern composition

## Pattern Extraction Workflow

### User Finds Useful Article

Example: Modern HTML features article with dialog, popover, invokers

### User Invokes Extraction

Skill uses Playwright MCP to:
1. Navigate to URL and extract article content
2. Identify relevant patterns
3. Extract pattern details (use case, implementation, benefits)
4. Format as structured markdown
5. Create skill in user's project

### Output: Project-Local Skill

```
user-project/
└── .claude/
    └── skills/
        └── html-dialog-pattern/
            └── SKILL.md             # Auto-invoked when working with dialogs
```

### Progressive Disclosure Benefits

- **Initial load**: ~100 tokens (skill metadata)
- **Full pattern**: Loads only when Claude detects dialog work
- **Token savings**: Massive compared to always-loaded rules

## Key References

- **Plaited Workshop**: `src/workshop/cli.ts` - Story discovery and test execution
- **Plaited Testing**: `src/testing/` - Story-based testing utilities
- **Bun Hot Reload**: https://bun.sh/docs/guides/http/hot
- **MCP Protocol**: https://modelcontextprotocol.io/
- **Skills Explained**: https://www.claude.com/blog/skills-explained
- **Claude Code Skills**: https://code.claude.com/docs/en/skills
- **Claude Code Rules**: https://code.claude.com/docs/en/memory#modular-rules-with-claude-rules
- **Mermaid Diagrams**: https://mermaid.js.org/

## Version History

### 0.1.0 (2025-12-24)

**Implemented:**
- ✅ Plaited Patterns skill with comprehensive framework documentation
- ✅ Extract Web Pattern skill for user-driven pattern extraction
- ✅ SessionStart hook for dependency checking and CLI help
- ✅ Mermaid diagram conversion for token efficiency
- ✅ Behavioral programming foundations
- ✅ Template and styling patterns
- ✅ Testing workflow documentation
- ✅ Thread replacement prevention (BP anti-pattern fix)

**Design Decisions:**
- ✅ Skills over rules for progressive disclosure
- ✅ User-owned pattern extraction (not plugin-bundled)
- ✅ No internal rule promotion (unnecessary with skill-first approach)

**Not Implemented:**
- ❌ Outcome patterns
- ❌ MCP server integration
- ❌ Outcome designer skill
- ❌ Auto-preview hook

## Next Steps

1. **Test extract-web-pattern skill** with real article
2. **Define first outcome pattern** (auth-flow) as example
3. **Implement auto-preview PostToolUse hook** for `*.stories.tsx`
4. **Build MCP server** with Bun for live preview
5. **Create outcome designer skill** that generates templates
