# Studio Plugin - Planning Document

## Overview

A Claude Code plugin for AI-assisted design of Plaited templates for MCP ext-apps and agent-driven interfaces (A2UI). Uses outcome-based design patterns following Nielsen Norman Group's generative UI principles.

## Key Decisions

### 1. **Vanilla JS Over React**
- ✅ No React dependency for MCP ext-apps wrapper
- ✅ Aligns with Plaited's Web Components foundation
- ✅ Lighter bundle, faster startup
- ✅ Direct postMessage communication

### 2. **Bun as Required Runtime**
- ✅ Required for entire plugin (not a limitation, it's a feature)
- ✅ Bun HTTP server for serving stories
- ✅ `bun --hot` for module hot reload
- ✅ Workshop CLI integration

### 3. **Outcome-Based Design Over Components**
- ✅ Commands and skills focus on user outcomes (auth-flow, data-table, etc.)
- ✅ Define constraints and guardrails, not specific UI components
- ✅ Must-show / should-show / never-show categorization

### 4. **Shared Knowledge Base**
- ✅ `.claude/rules/` contains patterns both skills and commands reference
- ✅ CLAUDE.md as integration hub
- ✅ Single source of truth for outcome patterns

## Plugin Structure

```
plugins/studio/
├── .claude-plugin/
│   └── plugin.json                          # Plugin manifest
├── CLAUDE.md                                 # Plugin-level instructions
├── .claude/
│   ├── rules/                                # SHARED KNOWLEDGE BASE
│   │   ├── outcomes/                         # Outcome patterns
│   │   │   ├── auth-flow.md
│   │   │   ├── data-table.md
│   │   │   ├── form-validation.md
│   │   │   ├── modal-dialog.md
│   │   │   └── navigation.md
│   │   ├── constraints/                      # Design constraints
│   │   │   ├── behavioral-programs.md        # BP requirements
│   │   │   ├── signal-patterns.md            # Signal usage rules
│   │   │   ├── accessibility.md              # A11y standards
│   │   │   └── web-components.md             # Shadow DOM patterns
│   │   ├── templates/                        # Template structures
│   │   │   ├── component-scaffold.md
│   │   │   ├── story-template.md
│   │   │   └── bp-thread-template.md
│   │   └── patterns/                         # Web API patterns
│   │       ├── web-apis/
│   │       ├── performance/
│   │       ├── accessibility/
│   │       └── html-features/
│   ├── skills/
│   │   └── outcome-designer/
│   │       ├── SKILL.md                      # References .claude/rules/
│   │       └── helpers/
│   └── commands/
│       ├── auth-flow.md                      # References outcomes/auth-flow.md
│       ├── data-table.md
│       ├── form-validation.md
│       └── modal-dialog.md
├── hooks/
│   ├── hooks.json
│   ├── check-bun.sh                          # SessionStart: verify Bun installed
│   └── auto-preview.sh                       # PostToolUse: launch workshop
├── mcp-server/
│   ├── server.ts                             # Bun HTTP + MCP protocol
│   ├── tools/
│   │   ├── generate-template.ts
│   │   ├── preview-template.ts
│   │   └── validate-bp-pattern.ts
│   └── ui/
│       ├── plaited-mcp-bridge.ts             # Vanilla JS wrapper
│       ├── iframe-sandbox.html
│       └── render-story.ts                   # Reuses workshop discovery
├── .mcp.json                                 # MCP server configuration
└── README.md
```

## Component Breakdown

### 1. Hooks

#### SessionStart: check-bun.sh
```bash
#!/usr/bin/env bash
# Verify Bun >= 1.2.9 installed
# Guide installation if missing
```

#### PostToolUse: auto-preview.sh
```bash
#!/usr/bin/env bash
# Triggered when *.stories.tsx created
# Starts: bun --hot plaited dev
# User sees live preview immediately
```

### 2. MCP Server (Bun-based)

**server.ts**: Dual-purpose
- MCP protocol handler (StdioServerTransport)
- Bun HTTP server serving stories on port 3500
- Development mode with hot reload

**Tools provided:**
- `generate_template`: Creates Plaited template from outcome description
- `preview_template`: Returns MCP ext-app UI for live preview
- `validate_bp_pattern`: Checks behavioral programming correctness

**UI wrapper (vanilla JS):**
- `plaited-mcp-bridge.ts`: postMessage bridge between MCP client and story
- `iframe-sandbox.html`: Entry point for MCP ext-apps
- `render-story.ts`: Reuses existing workshop discovery infrastructure

### 3. Skills

**outcome-designer/SKILL.md**:
- Model-invoked (automatic when user describes needs)
- Reads `.claude/rules/outcomes/` patterns
- Applies `.claude/rules/constraints/`
- Generates template + story + BP program
- Validates against Plaited standards

### 4. Commands

**Outcome-based shortcuts:**
- `/plaited-design:auth-flow [args]`
- `/plaited-design:data-table [args]`
- `/plaited-design:form-validation [args]`
- `/plaited-design:modal-dialog [args]`

Each command:
- References same `.claude/rules/outcomes/` file as skill
- User-invoked (explicit)
- Accepts arguments to customize outcome

### 5. Shared Rules

**`.claude/rules/outcomes/[pattern].md` template:**
```markdown
# [Outcome Name]

## User Goal
[What user needs to accomplish]

## Required Elements
[UI elements needed]

## Behavioral Program Pattern
\`\`\`typescript
// BP threads, signals, event handling
\`\`\`

## Constraints
- See @.claude/rules/constraints/behavioral-programs.md
- See @.claude/rules/constraints/accessibility.md

## Template Structure
[Shadow DOM, p-target bindings, etc.]
```

**`.claude/rules/patterns/` categories:**
- `web-apis/`: Modern Web APIs (Intersection Observer, Priority Hints, etc.)
- `performance/`: Resource hints, loading strategies
- `accessibility/`: ARIA, semantic HTML, keyboard nav
- `html-features/`: Dialog, Popover, Invokers API, etc.

## Integration Workflow

### User Flow
1. User: "I need authentication with OAuth"
2. Skill `outcome-designer` auto-invokes OR user types `/plaited-design:auth-flow`
3. Both read `.claude/rules/outcomes/auth-flow.md`
4. Generate template following Plaited patterns
5. PostToolUse hook triggers `auto-preview.sh`
6. Workshop starts with `bun --hot plaited dev`
7. MCP server serves preview as ext-app UI
8. User sees live preview, iterates via chat
9. Hot reload updates instantly

### MCP Ext-Apps Integration
```
MCP client conversation
         ↓
    MCP server tool: generate_template
         ↓
    Returns ext-app UI resource
         ↓
    Bun HTTP server (localhost:3500)
         ↓
    iframe-sandbox.html
         ↓
    Vanilla JS bridge (postMessage)
         ↓
    Plaited story renders (Web Components)
```

## Local Research Helper

**Location:** `.claude/commands/extract-web-pattern.md`

**Purpose:** Extract Web API patterns from articles to populate plugin knowledge base

**Usage:**
```bash
/extract-web-pattern [URL]
```

**Articles to extract:**
1. https://javascript.plainenglish.io/make-any-app-load-faster-with-just-6-lines-of-html-fe091cb9fdf6
2. https://javascript.plainenglish.io/one-line-of-html-that-makes-external-links-safer-95fe4ba6ff28
3. https://javascript.plainenglish.io/how-frontend-developers-can-handle-millions-of-api-requests-without-crashing-everything-dc464a82c46d
4. https://pixicstudio.medium.com/9-underused-html-features-thatll-make-your-web-apps-faster-and-more-accessible-c23d30e92a26
5. https://pixicstudio.medium.com/html-invokers-the-coolest-api-you-arent-using-yet-e78c3ddee927

**Note:** Uses Playwright MCP with `--extension` flag for login-protected articles

**Output:** Formatted markdown for `.claude/rules/patterns/[category]/`

## Implementation Phases

### Phase 1: Core Hook + Workshop ✅ Created
- [x] PostToolUse hook invoking `bun --hot plaited dev`
- [x] Bun detection on SessionStart
- [x] Auto-story generation script
- [x] Plugin directory structure
- [x] Local `/extract-web-pattern` command

### Phase 2: MCP Server (Bun-based)
- [ ] Basic MCP server with `generate_template` tool
- [ ] Bun HTTP server serving stories
- [ ] Template validation tools
- [ ] File watching integration

### Phase 3: MCP UI Conversion
- [ ] Convert `PlaitedFixture` to vanilla JS MCP ext-app wrapper
- [ ] Bridge `story()` format to MCP resource format
- [ ] Interactive preview with postMessage
- [ ] Reuse workshop discovery

### Phase 4: Outcome Patterns
- [ ] Define initial outcome patterns (auth, forms, tables, modals)
- [ ] Create constraint rules (BP, signals, a11y, web components)
- [ ] Build outcome-designer skill
- [ ] Create outcome-based commands

### Phase 5: Web API Patterns
- [ ] Extract patterns from articles using `/extract-web-pattern`
- [ ] Populate `.claude/rules/patterns/`
- [ ] Integrate into skill/command knowledge

### Phase 6: Advanced Features
- [ ] A2UI integration (agent-driven refinement loops)
- [ ] Constraint catalog expansion
- [ ] Design system integration

## Next Steps After Session Restart

1. **Restart Claude session** to enable Playwright MCP tools
2. **Run `/extract-web-pattern` with Playwright** on article #2
3. **Build first outcome pattern** (auth-flow.md) as template
4. **Implement MCP server** with Bun
5. **Create outcome-designer skill**

## Key References

- **MCP ext-apps**: https://modelcontextprotocol.github.io/ext-apps/api/
- **A2UI**: https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/
- **Generative UI principles**: https://www.nngroup.com/articles/generative-ui/
- **Bun hot reload**: https://bun.sh/docs/guides/http/hot
- **Plaited workshop**: `src/workshop/cli.ts`
- **Plaited testing**: `src/testing/`
