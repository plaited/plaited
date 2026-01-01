---
description: Validate skill directories against AgentSkills spec
allowed-tools: Bash, mcp__agent-skills-spec__*
---

# Validate Skills

Validate skill directories against the [AgentSkills specification](https://agentskills.io/specification).

**Paths to validate:** $ARGUMENTS (default: `.claude/skills/`)

## Instructions

### Step 1: Run Validation

```bash
bun plaited validate-skill $ARGUMENTS
```

### Step 2: Report Results

Show the CLI output to the user. If there are errors, explain how to fix them based on the validation rules.

### Step 3: Check Spec (if needed)

If the user needs clarification on validation rules, use the agent-skills-spec MCP server to query the latest specification.
