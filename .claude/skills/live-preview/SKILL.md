---
name: live-preview
description: Start dev server and interact with stories for visual feedback. Use when previewing templates, taking screenshots, or testing visual changes.
license: ISC
compatibility: Requires bun
allowed-tools: Bash, mcp__chrome-devtools__*
---

# Live Preview

Start dev server and interact with stories for visual feedback.

## Purpose

This skill provides:
- Dev server with hot reload via CLI
- Story URL generation via code-query skill
- Browser automation via Chrome DevTools MCP

## Start Dev Server

```bash
bun --hot plaited dev [paths...] [-p <port>]
```

**Arguments:**
- `paths`: Directories to discover stories (default: current directory)
- `-p, --port`: Server port (default: 3000)

**Console Output:**
```
🔍 Discovering stories in: /path/to/project
📄 Found 5 story exports
✅ Server ready at http://localhost:3000
🔥 Hot reload enabled via WebSocket

BasicButton: http://localhost:3000/@story/...
PrimaryButton: http://localhost:3000/@story/...
```

The server outputs story URLs directly - parse stdout for programmatic access.

## Get Story URLs

Use the code-query skill for story discovery and URL generation:

```bash
# Discover all stories
bun .claude/skills/code-query/scripts/query-stories.ts src/

# Get URL for specific story
bun .claude/skills/code-query/scripts/query-story-url.ts src/button.stories.tsx PrimaryButton
```

## Chrome DevTools MCP

After starting the server, use Chrome DevTools MCP for browser automation:

```typescript
// Navigate to story
mcp__chrome-devtools__navigate_page({ url: storyUrl })

// Take screenshot
mcp__chrome-devtools__take_screenshot({ filename: 'preview.png' })

// Get accessibility tree snapshot
mcp__chrome-devtools__take_snapshot({})
```

## Workflow

1. Start server: `bun --hot plaited dev src/`
2. Get story URL from stdout or via code-query
3. Navigate with Chrome DevTools MCP
4. Interact, screenshot, or snapshot as needed
5. Hot reload reflects code changes automatically

## Related Skills

- **code-query** - Story discovery and URL generation
- **design-iteration** - Interactive design refinement
- **plaited-framework-patterns** - Template patterns
