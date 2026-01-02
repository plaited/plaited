# Plugin Development Standards

Guidelines for developing Claude Code plugin assets:
- `.claude/skills/` - Contextual knowledge and scripts
- `.claude/commands/` - User-invocable slash commands
- `.claude/agents/` - Specialized agent definitions

## Plugin Compatibility

Plugin assets are published together. Follow these rules for compatibility:

### Path References

**For scripts in plugin assets:**
- Use relative paths from the asset directory: `scripts/query-stories.ts`
- Not absolute paths: `.claude/skills/workbench/scripts/query-stories.ts`

**For source code references:**
- Use package export paths: `plaited/workshop/get-paths.ts`
- Not source paths: `src/workshop/get-paths.ts`
- Agents can resolve package paths via `package.json` exports field from cwd

### No Rules References

- **Plugin assets must NOT reference rules** (`.claude/rules/`) as rules are not part of the Claude plugins spec
- Rules are project-specific and not included when plugins are published
- Any guidance that would go in rules should be self-contained within the asset's documentation

### Self-Contained Documentation

- Each plugin asset should be fully self-contained
- Include all necessary context in the asset's markdown files or references
- Don't assume access to project-specific files outside the asset directory

## Directory Structures

### Skills
```
.claude/skills/<skill-name>/
├── SKILL.md           # Main documentation (required)
├── scripts/           # Executable scripts (optional)
│   └── tests/         # Tests for scripts
└── references/        # Additional documentation (optional)
```

### Commands
```
.claude/commands/<command-name>.md   # Command definition
```

### Agents
```
.claude/agents/<agent-name>.md       # Agent definition
```

## Testing

See `.claude/rules/testing.md` for script testing patterns.
