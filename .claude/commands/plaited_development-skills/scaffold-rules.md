---
description: Scaffold or merge development rules for your AI coding agent
allowed-tools: Glob, Read, Write, Edit, AskUserQuestion
---

# Scaffold Rules

Generate development rules adapted to the user's AI coding agent environment.

**Arguments:** $ARGUMENTS (optional: rule categories to scaffold)

## Instructions

### Step 1: Get Processed Templates from CLI

Call the CLI to get rule templates with variables already processed:

```bash
bunx @plaited/development-skills scaffold-rules --format=json
```

The CLI will:
- Read bundled rule templates from the package
- Process template variables ({{LINK:*}}, {{#if}}, etc.)
- Output JSON with processed content

Parse the JSON output to get available templates. The output structure is:
```json
{
  "templates": {
    "accuracy": {
      "filename": "accuracy.md",
      "content": "# Accuracy and Confidence Standards\n...",
      "description": "95% confidence threshold, verification protocols"
    },
    "testing": { ... },
    ...
  }
}
```

### Step 2: Detect Agent & Scan Existing Rules

The CLI supports 2 target formats:

| Target | Rules Location | Use Case |
|--------|----------------|----------|
| `claude` | `.claude/rules/` | Claude Code (default) |
| `agents-md` | `.plaited/rules/` + `AGENTS.md` | Universal format for Cursor, Factory, Copilot, Windsurf, Cline, Aider, and 60,000+ other projects |

Check for existing configuration:
```
.claude/          → Use --agent=claude (default)
AGENTS.md         → Use --agent=agents-md
.plaited/rules/   → Use --agent=agents-md
Any other agent   → Use --agent=agents-md (universal)
```

**Always scan for existing rules before writing.** Use Read tool to check what's already there.

Analyze existing content to understand:
- What conventions are already defined
- What sections/topics are covered
- The writing style and format used

### Step 3: Ask User Preferences

Present available templates from CLI output and ask which to scaffold (if not provided in $ARGUMENTS):

```
? Select rule categories to scaffold:
  ◉ accuracy - 95% confidence threshold, verification protocols
  ◉ bun-apis - Prefer Bun over Node.js APIs
  ◉ git-workflow - Conventional commits, multi-line messages
  ◉ github - GitHub CLI patterns for PRs/issues
  ◉ code-review - TypeScript conventions, module organization
  ◉ testing - Bun test runner conventions
```

### Step 4: Propose Merges (If Existing Rules Found)

If existing rules were found in Step 2, compare with CLI output:

1. **Identify overlaps**: Which templates already exist as files
2. **Show what would be added**: Preview the content from CLI
3. **Ask for approval**:

```
? Existing rules found. How would you like to proceed?

  For "git-workflow.md" (exists):
  ◯ Keep existing (skip)
  ◉ Merge (add missing sections)
  ◯ Replace entirely

  For "testing.md" (new):
  ◉ Add to rules
  ◯ Skip
```

For merges:
- Use Read to get existing content
- Show diff of what would change
- Get approval before writing

### Step 5: Write Rules

After user approval, write the rules using the content from CLI output:

- Use Write tool with `content` from CLI JSON
- Create directories if needed (`.claude/rules/` or `.plaited/rules/`)
- Write/merge files as approved
- Report what was created/modified

### Rule Content Guidelines

The CLI processes template variables automatically. The content in the JSON output is ready to write to files.

**Template Processing:**
The CLI handles:
- Template variable substitution ({{LINK:*}}, {{AGENT_NAME}}, etc.)
- Capability-based conditionals ({{#if has-sandbox}}, {{#if supports-slash-commands}})
- Template header removal
- Cross-reference formatting for detected agent

**Available Rule Topics:**

**Bun APIs:**
- Prefer `Bun.file()` over `fs` APIs
- Use `Bun.$` for shell commands
- Use `Bun.write()` for file writes
- Use `import.meta.dir` for current directory

**Git Workflow:**
- Conventional commit prefixes (feat, fix, refactor, docs, chore, test)
- Multi-line commit message format
- Sandbox workarounds (Claude Code only)

**GitHub CLI:**
- Prefer `gh` CLI over WebFetch for GitHub URLs
- PR review patterns
- Issue/PR JSON field references

**TypeScript Conventions:**
- Prefer `type` over `interface`
- No `any` types (use `unknown` with guards)
- Arrow functions preferred
- Object parameter pattern for 2+ params
- PascalCase for types, `PascalCaseSchema` for Zod schemas

**Testing Patterns:**
- Use `test()` instead of `it()`
- `*.spec.ts` naming convention
- No conditionals around assertions
- Assert existence before checking values

### Step 6: Output Summary

After completion, summarize what was done:

```
✅ Rules scaffolded for Claude Code:

  Created:
    • .claude/rules/testing.md - Bun test conventions
    • .claude/rules/bun-apis.md - Prefer Bun over Node.js

  Merged:
    • .claude/rules/git-workflow.md - Added commit message formats

  Skipped:
    • accuracy.md - Already exists, user chose to keep

💡 Review the generated rules at .claude/rules/ and customize as needed.
```

### CLI Usage

The scaffold-rules CLI supports 2 target formats:

```bash
# Default: outputs all rules for Claude Code
bunx @plaited/development-skills scaffold-rules

# Universal AGENTS.md format (works with Cursor, Factory, Copilot, Windsurf, Cline, Aider, etc.)
bunx @plaited/development-skills scaffold-rules --agent=agents-md

# Custom paths (for specific agent directories or monorepos)
bunx @plaited/development-skills scaffold-rules --agent=agents-md --rules-dir=.cursor/rules
bunx @plaited/development-skills scaffold-rules --agent=agents-md --agents-md-path=docs/AGENTS.md

# Filter specific rules
bunx @plaited/development-skills scaffold-rules --rules testing --rules bun-apis
```

**Options:**
- `--agent` / `-a`: Target format (`claude` or `agents-md`)
- `--rules-dir` / `-d`: Custom rules directory path (overrides default)
- `--agents-md-path` / `-m`: Custom AGENTS.md file path (default: `AGENTS.md`)
- `--format` / `-f`: Output format (json)
- `--rules` / `-r`: Specific rules to include (can be used multiple times)

**Output Structure:**
The JSON output includes metadata about the target:
```json
{
  "agent": "agents-md",
  "rulesPath": ".plaited/rules",
  "agentsMdPath": "AGENTS.md",
  "format": "agents-md",
  "supportsAgentsMd": true,
  "agentsMdContent": "# AGENTS.md\n...",
  "templates": { ... }
}
```

For `agents-md` format, write:
1. Individual rule files to the path specified in `rulesPath`
2. The `agentsMdContent` to the path specified in `agentsMdPath`

This provides maximum portability - rules work with any AGENTS.md-compatible agent (60,000+ projects support this format).
