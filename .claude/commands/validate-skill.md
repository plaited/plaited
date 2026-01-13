---
description: Validate skill directories against AgentSkills spec
allowed-tools: Bash, Glob, mcp__agent-skills-spec__*
---

# Validate Skills

Validate skill directories against the AgentSkills specification.

**Paths to validate:** $ARGUMENTS (default: `.claude/skills/`)

## Instructions

### Step 1: Locate validate-skill Skill

Find the validate-skill skill directory. Use Glob to locate it:
```glob
**/validate-skill/SKILL.md
```

The skill directory is the parent of SKILL.md.

### Step 2: Run Validation

From the skill directory, run:
```bash
bun <skill-dir>/scripts/validate-skill.ts $ARGUMENTS
```

### Step 3: Report Results

Show the CLI output to the user. If there are errors, use the `agent-skills-spec` MCP server to get the latest specification and explain how to fix them.

### Step 4: Query Spec (if needed)

For clarification on validation rules, query the `agent-skills-spec` MCP server for the current specification.
