---
name: live-preview
description: Start dev server and interact with stories for visual feedback. Use when previewing templates, taking screenshots, or testing visual changes.
license: ISC
compatibility: Requires bun
allowed-tools: Bash, mcp__playwright__*
---

# Live Preview

Start dev server and interact with stories for visual feedback.

## Purpose

This skill provides:
- Dev server management via useServerManager
- Story URL generation via code-query
- Browser automation via Playwright MCP

## Scripts

### preview-start.ts

Start the dev server and return story URLs.

```bash
bun preview-start.ts [paths...] [--port <port>]
```

**Arguments:**
- `paths`: Directories to discover stories (default: current directory)
- `--port, -p`: Server port (default: 3000)

**Returns:**
```json
{
  "serverUrl": "http://localhost:3000",
  "stories": [
    { "exportName": "basicButton", "route": "/@story/..." }
  ]
}
```

### preview-story.ts

Get URL for a specific story (uses code-query).

```bash
bun preview-story.ts <file> <exportName> [--port <port>]
```

**Arguments:**
- `file`: Story file path
- `exportName`: Story export name
- `--port, -p`: Server port (default: 3000)

**Returns:**
```json
{
  "url": "http://localhost:3000/@story/...",
  "storyFile": "src/button.stories.tsx",
  "exportName": "basicButton"
}
```

## Usage with Playwright MCP

After starting the server, use Playwright MCP for browser automation:

```typescript
// Navigate to story
await mcp__playwright__browser_navigate({ url: storyUrl })

// Take screenshot
await mcp__playwright__browser_take_screenshot({ filename: 'preview.png' })

// Get accessibility snapshot
await mcp__playwright__browser_snapshot({})
```

## Workflow

1. Start server with `preview-start.ts`
2. Get story URL with `preview-story.ts` or code-query
3. Navigate with Playwright MCP
4. Interact, screenshot, or snapshot as needed
5. Hot reload reflects code changes automatically

## Integration

### With code-query

Use code-query for story discovery:
```bash
bun query-stories.ts src/
bun query-story-url.ts src/button.stories.tsx PrimaryButton
```

### With design-iteration

The design-iteration skill uses live-preview for visual feedback during iterative design work.

## Related Skills

- **code-query** - Story discovery and URL generation
- **design-iteration** - Interactive design refinement
- **plaited-framework-patterns** - Template patterns
