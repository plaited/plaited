# Plugin Development

Guidelines for developing Claude Code plugins in the `plugins/` directory.

## Cache Management

**IMPORTANT**: When developing plugins locally, Claude Code caches plugins in `~/.claude/plugins-cache/`. Changes to plugin files will NOT be reflected until the cache is cleared.

### Workflow for Plugin Changes

```bash
# After making changes to any plugin files
rm -rf ~/.claude/plugins-cache

# Then restart Claude Code
claude
```

**When to clear cache:**
- After modifying `plugin.json`
- After updating `SKILL.md` files
- After changing hook scripts
- After adding/removing skills or hooks
- Whenever plugin changes aren't appearing in Claude Code

## Plugin Structure

Plugins in this project follow the local marketplace pattern:

```
plugins/
├── studio/
│   ├── .claude-plugin/
│   │   └── plugin.json       # Plugin manifest
│   ├── skills/
│   │   └── plaited-patterns/
│   │       └── SKILL.md      # Skill definition
│   └── hooks/
│       ├── hooks.json        # Hook configuration
│       └── SessionStart      # Hook script (must be executable)
```

### Plugin Registration

Plugins are registered via `.claude-plugin/marketplace.json` at the project root:

```json
{
  "plugins": [
    {
      "name": "studio",
      "source": "./plugins/studio",
      "category": "development"
    }
  ]
}
```

And enabled in `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "plaited": {
      "source": {
        "source": "directory",
        "path": "."
      }
    }
  },
  "enabledPlugins": {
    "studio@plaited": true
  }
}
```

## Skills vs Hooks Visibility

Understanding what appears in the `/plugins` UI:

- **Hooks**: Show in "Installed components" section
- **Skills**: Auto-invoked by Claude, do NOT appear in UI
- **Commands**: Show in "Installed components" section (if defined)
- **Agents**: Show in "Installed components" section (if defined)

**Skills are model-invoked** - Claude decides when to use them based on the skill's description. They work invisibly in the background.

## Testing Plugin Changes

1. **Clear cache** (always first step)
2. **Restart Claude Code**
3. **Verify loading**:
   - Check `/plugins` for hook visibility
   - Ask Claude: "What skills are available?"
   - Test skill auto-invocation by triggering its description

## Common Issues

### Plugin changes not appearing
**Solution**: Clear cache with `rm -rf ~/.claude/plugins-cache` and restart

### Skill not auto-invoking
**Cause**: Skills are model-invoked based on description matching
**Solution**: Ensure skill description clearly states WHEN to use it

### Hook script not executing
**Cause**: Script may not be executable
**Solution**: `chmod +x plugins/studio/hooks/ScriptName`

## References

- [Claude Code Plugin Reference](https://code.claude.com/docs/en/plugins-reference)
- [Agent Skills Documentation](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
